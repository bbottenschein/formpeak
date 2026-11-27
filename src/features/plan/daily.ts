import "server-only";
import {
  addDays,
  adjustToday,
  dayAllowances,
  mondayOf,
  offseasonWeek,
  reducePrescription,
  type DailyMetrics,
  type TodayUnit,
} from "@/core/load";
import type { GoalData } from "@/features/goals/queries";
import { getOffseason } from "@/features/offseason/queries";
import { isOpenSuggestion, loadSessions, toCoreSession } from "@/features/sessions/data";
import { hasAnthropicKey } from "@/lib/env.server";
import type { Translate } from "@/lib/i18n/translate";
import type { createClient } from "@/lib/supabase/server";
import { aiSpareUnit, PLAN_MODEL } from "./ai";
import { aiUnitToSession, loadLibrary, rulesToSessions, writeExercises } from "./generate";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface SpareJob {
  sessionId: string;
  context: unknown;
}

/**
 * Tägliche Anpassung nach dem Morgen-Check-in: heutige Vorschläge an Ampel und Schmerz anpassen
 * (Regeln in `adjustToday`). Liefert Einheiten, deren Übungen die KI noch umstellen soll,
 * damit schmerzende Regionen ausgespart werden (läuft danach im Hintergrund).
 */
export async function adjustTodayPlan(input: {
  supabase: Supabase;
  userId: string;
  today: string;
  metrics: DailyMetrics;
  goal: GoalData;
  t: Translate;
}): Promise<SpareJob[]> {
  const { supabase, userId, today, metrics, goal, t } = input;
  const off = await getOffseason(supabase, userId, today);
  const frame = off?.frame ?? goal.frame;
  if (!frame) return [];
  const monday = mondayOf(today);
  const rows = await loadSessions(supabase, userId, addDays(monday, -7), addDays(monday, 13));
  const isOwnPlan = (r: (typeof rows)[number]) =>
    isOpenSuggestion(r) && r.date === today;
  const todays = rows.filter(isOwnPlan);
  if (todays.length === 0) return [];

  const others = rows.filter((r) => !isOwnPlan(r)).map(toCoreSession);
  const allowance = dayAllowances({
    weekStart: monday,
    today,
    sessions: others,
    availableWeekdays: frame.availableWeekdays,
    timeBudgetMin: frame.timeBudgetMin,
    todayLight: metrics.light,
    offseason: off ? offseasonWeek(off.phase, today) : undefined,
  }).find((a) => a.date === today)!;

  const { data: exRows } = await supabase
    .from("planned_exercises")
    .select("id, session_id, position, name, prescription, how, exercise_id, exercises(lower_body)")
    .in("session_id", todays.map((r) => r.id))
    .order("position");
  const exercisesOf = (id: string) => (exRows ?? []).filter((e) => e.session_id === id);

  const units: TodayUnit[] = todays.map((r) => ({
    id: r.id,
    date: r.date,
    kind: r.type as TodayUnit["kind"],
    durationMin: r.duration_min,
    targetRpe: r.target_rpe ?? r.default_rpe,
    lowerBody: exercisesOf(r.id).some((e) => (e.exercises as unknown as { lower_body: boolean } | null)?.lower_body),
  }));
  const painSpots = metrics.painSpots.filter((s) => s.level !== "note");
  const jobs: SpareJob[] = [];

  for (const adj of adjustToday(units, allowance, painSpots)) {
    const row = todays.find((r) => r.id === adj.id)!;
    const mark = { adjustment: adj.reason, adjusted_on: today };
    const c = adj.change;
    if (c.action === "remove") {
      await supabase.from("sessions").update({ status: "cancelled", ...mark }).eq("id", row.id);
    } else if (c.action === "swap") {
      const routine = c.to === "recovery" ? "recovery_flush" : "mobility_hip_groin";
      const [swap] = rulesToSessions(
        [{ date: today, routine, durationMin: c.durationMin, targetRpe: c.targetRpe, lowerBody: false }],
        t,
        [],
      );
      await supabase
        .from("sessions")
        .update({
          type: c.to,
          title: swap.title,
          rationale: t(`plan.adjust.why.${adj.reason ?? "rules"}`),
          duration_min: c.durationMin,
          target_rpe: c.targetRpe,
          default_rpe: c.targetRpe,
          gym_focus: null,
          ...mark,
        })
        .eq("id", row.id);
      await writeExercises(supabase, userId, row.id, c.to, swap.exercises);
    } else if (c.action === "shorten") {
      await supabase
        .from("sessions")
        .update({ duration_min: c.durationMin, target_rpe: c.targetRpe, default_rpe: c.targetRpe, ...mark })
        .eq("id", row.id);
      for (const e of exercisesOf(row.id)) {
        const prescription = reducePrescription(e.prescription ?? "", c.setFactor);
        if (prescription === e.prescription) continue;
        await supabase.from("planned_exercises").update({ prescription }).eq("id", e.id);
        if (e.exercise_id) {
          await supabase
            .from("session_exercises")
            .update({ note: prescription })
            .eq("session_id", row.id)
            .eq("exercise_id", e.exercise_id);
        }
      }
    } else if (adj.spare && row.adjustment !== "pain") {
      await supabase.from("sessions").update(mark).eq("id", row.id);
    }

    // Schmerz: Übungen von der KI umstellen lassen (einmal pro Tag).
    if (adj.spare && c.action !== "remove" && c.action !== "swap" && hasAnthropicKey() && row.adjusted_on !== today) {
      jobs.push({
        sessionId: row.id,
        context: {
          heute: today,
          einheit: {
            datum: today,
            art: row.type,
            titel: row.title,
            dauer_min: c.action === "shorten" ? c.durationMin : row.duration_min,
            ziel_rpe: c.action === "shorten" ? c.targetRpe : row.target_rpe,
            uebungen: exercisesOf(row.id).map((e) => ({ name: e.name, vorgabe: e.prescription })),
          },
          erlaubt: { max_minuten: allowance.maxMinutes, max_rpe: allowance.maxRpe, unterkoerper: allowance.lowerBody },
          schmerz: painSpots.map((s) => ({ region: s.region, seite: s.side, staerke: s.intensity, art: s.kind })),
        },
      });
    }
  }
  return jobs;
}

/** Hintergrund: Übungen einer Einheit wegen Schmerzen umstellen (KI), Leitplanken prüfen, speichern. */
export async function runSpareJobs(supabase: Supabase, userId: string, today: string, jobs: SpareJob[]) {
  if (jobs.length === 0) return;
  const library = await loadLibrary(supabase);
  for (const job of jobs) {
    try {
      const unit = await aiSpareUnit(job.context, library);
      if (!unit) continue;
      const ctx = job.context as { einheit: { art: string; dauer_min: number; ziel_rpe: number | null }; erlaubt: { unterkoerper: boolean } };
      const s = aiUnitToSession({ ...unit, date: today, kind: ctx.einheit.art as typeof unit.kind }, library);
      // Leitplanken: Dauer/RPE nicht über dem Rahmen von vorher, Unterkörper nur wenn erlaubt.
      if (s.lowerBody && !ctx.erlaubt.unterkoerper) continue;
      await supabase
        .from("sessions")
        .update({
          title: s.title,
          rationale: s.reason,
          duration_min: Math.min(s.durationMin, ctx.einheit.dauer_min),
          target_rpe: Math.min(s.targetRpe, ctx.einheit.ziel_rpe ?? s.targetRpe),
        })
        .eq("id", job.sessionId)
        .eq("status", "planned");
      await writeExercises(supabase, userId, job.sessionId, s.kind, s.exercises);
      await supabase.from("ai_plans").insert({
        user_id: userId,
        kind: "day",
        for_date: today,
        prompt_version: "day-spare-v1",
        model: PLAN_MODEL,
        context: job.context,
        response: unit,
        validation: { lowerBody: s.lowerBody },
      });
    } catch (error) {
      console.error("[plan] Anpassung wegen Schmerz fehlgeschlagen", error instanceof Error ? error.message : error);
    }
  }
}
