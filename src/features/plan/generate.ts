import "server-only";
import {
  addDays,
  dayAllowances,
  enforcePlan,
  matchdayContext,
  matchdayLabel,
  validatePlan,
  weekLoads,
  type DailyMetrics,
  type PlanCheckContext,
} from "@/core/load";
import type { GoalData } from "@/features/goals/queries";
import { ensureFixtures, loadSessions, toCoreSession, type SessionRow } from "@/features/sessions/data";
import { ROUTINES } from "@/features/today/routines";
import { hasAnthropicKey } from "@/lib/env.server";
import type { Translate } from "@/lib/i18n/translate";
import type { createClient } from "@/lib/supabase/server";
import { aiWeekPlan, PLAN_MODEL, PROMPT_VERSION, type AiUnit, type AiWeekPlan, type LibraryExercise } from "./ai";
import { STALE_PENDING_MS } from "./queries";
import { rulesPlan } from "./rules-plan";
import type { PlannedSession, WeekPlanResult } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;


const isPlanSession = (s: SessionRow) => (s.planned_by === "ai" || s.planned_by === "rules") && s.status === "planned";

export interface PlanWeekInput {
  supabase: Supabase;
  userId: string;
  weekStart: string;
  today: string;
  goal: GoalData;
  /** Kennzahlen von heute (Ampel, Schmerz-Sperren), nur wenn heute in der Woche liegt. */
  todayMetrics: DailyMetrics | null;
  t: Translate;
  /** Vorhandenen Plan ersetzen („Neu planen“). */
  force?: boolean;
}

/**
 * Reserviert die Woche zum Planen. Liefert false, wenn schon ein Plan existiert oder gerade
 * erstellt wird – so entsteht auch bei parallelen Aufrufen nur ein Plan.
 */
async function claimWeek(supabase: Supabase, userId: string, weekStart: string, force: boolean): Promise<boolean> {
  const { data: inserted } = await supabase
    .from("week_plans")
    .upsert({ user_id: userId, week_start: weekStart, status: "pending" }, { onConflict: "user_id,week_start", ignoreDuplicates: true })
    .select("week_start");
  if (inserted && inserted.length > 0) return true;

  const { data: row } = await supabase
    .from("week_plans")
    .select("status, updated_at")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!row) return false;
  const stale = row.status === "pending" && Date.now() - Date.parse(row.updated_at) > STALE_PENDING_MS;
  if (row.status === "pending" && !stale) return false;
  if (!force && row.status === "ready") return false;
  if (!force && row.status === "failed") return false;

  const { data: claimed } = await supabase
    .from("week_plans")
    .update({ status: "pending" })
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .eq("updated_at", row.updated_at)
    .select("week_start");
  return Boolean(claimed && claimed.length > 0);
}

export async function loadLibrary(supabase: Supabase): Promise<LibraryExercise[]> {
  const { data } = await supabase.from("exercises").select("id, name, equipment, lower_body").order("name");
  return (data ?? []).map((e) => ({ id: e.id, name: e.name, equipment: e.equipment, lowerBody: Boolean(e.lower_body) }));
}

/** Letzte Gym-Leistungen (6 Wochen): pro Übung der schwerste Arbeitssatz. */
async function gymHistory(supabase: Supabase, userId: string, today: string) {
  const { data } = await supabase
    .from("session_exercises")
    .select("exercises(name), sessions!inner(date, status), exercise_sets(weight_kg, reps, set_type)")
    .eq("user_id", userId)
    .gte("sessions.date", addDays(today, -42))
    .eq("sessions.status", "done")
    .limit(200);
  const best = new Map<string, { datum: string; satz: string; gewicht: number }>();
  for (const row of data ?? []) {
    const ex = row.exercises as unknown as { name: string } | null;
    const s = row.sessions as unknown as { date: string } | null;
    if (!ex || !s) continue;
    for (const set of (row.exercise_sets ?? []) as { weight_kg: number | string; reps: number; set_type: string }[]) {
      if (set.set_type !== "working") continue;
      const w = Number(set.weight_kg);
      const cur = best.get(ex.name);
      if (!cur || s.date > cur.datum || (s.date === cur.datum && w > cur.gewicht)) {
        best.set(ex.name, { datum: s.date, satz: `${set.reps} Wdh × ${w} kg`, gewicht: w });
      }
    }
  }
  return [...best.entries()].map(([uebung, v]) => ({ uebung, datum: v.datum, bester_satz: v.satz }));
}

/** Übersetzt den Regel-Plan in Einheiten mit Titeln und erklärten Übungen. */
export function rulesToSessions(items: ReturnType<typeof rulesPlan>, t: Translate, library: LibraryExercise[]): PlannedSession[] {
  const byName = new Map(library.map((e) => [e.name, e.id]));
  return items.map((item) => {
    const r = ROUTINES[item.routine];
    return {
      date: item.date,
      kind: r.sessionType as PlannedSession["kind"],
      durationMin: item.durationMin,
      targetRpe: item.targetRpe,
      lowerBody: item.lowerBody,
      title: t(`routines.titles.${item.routine}`),
      gymFocus: r.sessionType === "gym" ? "full" : null,
      reason: t(`plan.rulesWhy.${item.routine}`),
      exercises: r.exercises.map((e) => ({
        name: t(`routines.exercises.${e.key as "squat"}`),
        prescription: e.reps
          ? t(`routines.reps.${e.reps as "12"}`)
          : e.seconds && e.seconds >= 120
            ? t("routines.minutes", { value: Math.round(e.seconds / 60) })
            : t("routines.seconds", { value: e.seconds ?? 0 }),
        how: t(`plan.how.${e.key as "squat"}`),
        exerciseId: (e.library && byName.get(e.library)) || null,
      })),
    };
  });
}

/** Eine Einheit der KI-Antwort übersetzen; Unterkörper ergibt sich aus der Bibliothek. */
export function aiUnitToSession(s: AiUnit, library: LibraryExercise[]): PlannedSession {
  const byName = new Map(library.map((e) => [e.name, e]));
  const exercises = s.exercises.slice(0, 10).map((e) => {
    const lib = e.libraryName ? byName.get(e.libraryName) : undefined;
    return {
      name: e.name.slice(0, 80),
      prescription: e.prescription.slice(0, 60),
      how: e.how.slice(0, 300),
      exerciseId: lib?.id ?? null,
    };
  });
  const lowerBody = s.exercises.some((e) => e.libraryName && byName.get(e.libraryName)?.lowerBody);
  return {
    date: s.date,
    kind: s.kind,
    title: s.title.slice(0, 60),
    durationMin: Math.max(5, Math.round(s.durationMin)),
    targetRpe: Math.min(10, Math.max(1, Math.round(s.targetRpe))),
    gymFocus: s.kind === "gym" ? (s.gymFocus ?? (lowerBody ? "full" : "upper")) : null,
    lowerBody,
    reason: s.reason.slice(0, 300),
    exercises,
  };
}

const aiToSessions = (plan: AiWeekPlan, library: LibraryExercise[]) => plan.sessions.map((s) => aiUnitToSession(s, library));

/** Übungen einer Einheit speichern (ersetzt vorhandene); Gym-Übungen auch ins Gym-Log. */
export async function writeExercises(
  supabase: Supabase,
  userId: string,
  sessionId: string,
  kind: PlannedSession["kind"],
  exercises: PlannedSession["exercises"],
) {
  await supabase.from("planned_exercises").delete().eq("session_id", sessionId);
  await supabase.from("session_exercises").delete().eq("session_id", sessionId);
  if (exercises.length > 0) {
    await supabase.from("planned_exercises").insert(
      exercises.map((e, position) => ({
        user_id: userId,
        session_id: sessionId,
        position,
        name: e.name,
        prescription: e.prescription,
        how: e.how,
        exercise_id: e.exerciseId,
      })),
    );
  }
  const gym = kind === "gym" ? exercises.filter((e) => e.exerciseId) : [];
  if (gym.length > 0) {
    await supabase.from("session_exercises").insert(
      gym.map((e, position) => ({ user_id: userId, session_id: sessionId, exercise_id: e.exerciseId, position, note: e.prescription })),
    );
  }
}

/**
 * Plant eine Woche (Mo–So) ab heute: Leitplanken berechnen, KI fragen (oder Regel-Plan),
 * Verstöße korrigieren, alte Vorschläge ersetzen und die Einheiten mit Übungen speichern.
 * Liefert false, wenn nicht geplant wurde (kein Ziel, Woche vorbei, schon geplant).
 */
export async function planWeek(input: PlanWeekInput): Promise<boolean> {
  const { supabase, userId, weekStart, today, goal, t } = input;
  const sunday = addDays(weekStart, 6);
  const frame = goal.frame;
  if (!goal.goal || !frame || sunday < today) return false;
  if (!(await claimWeek(supabase, userId, weekStart, Boolean(input.force)))) return false;

  try {
    await ensureFixtures(supabase, userId, addDays(weekStart, -7), addDays(weekStart, 13));
    const rows = await loadSessions(supabase, userId, addDays(weekStart, -28), addDays(weekStart, 13));
    const from = weekStart > today ? weekStart : today;
    const replaced = rows.filter((r) => isPlanSession(r) && r.date >= from && r.date <= sunday);
    const replacedIds = new Set(replaced.map((r) => r.id));
    const kept = rows.filter((r) => !replacedIds.has(r.id));
    const sessions = kept.map(toCoreSession);

    const light = input.todayMetrics?.light;
    const allowances = dayAllowances({
      weekStart,
      today,
      sessions,
      availableWeekdays: frame.availableWeekdays,
      timeBudgetMin: frame.timeBudgetMin,
      todayLight: today >= weekStart && today <= sunday ? light : undefined,
    });
    const ctx: PlanCheckContext = { allowances, sessions, maxMainUnits: frame.extraSessionsPerWeek, today };
    const { existing, reference } = weekLoads([], ctx);
    const budget = reference > 0 ? Math.max(0, Math.round(reference * 1.15 - existing)) : null;

    let result: WeekPlanResult | null = null;
    let log: { context: unknown; response: unknown; validation: unknown } | null = null;
    const library = await loadLibrary(supabase);

    if (hasAnthropicKey()) {
      const matchDates = kept.filter((r) => r.type === "match" && r.status !== "cancelled").map((r) => r.date);
      const context = {
        heute: today,
        woche: allowances.map((a) => ({
          datum: a.date,
          wochentag: t(`weekdays.long.${new Date(`${a.date}T00:00:00Z`).getUTCDay() as 0}`),
          spieltag: matchdayLabel(matchdayContext(a.date, matchDates)),
          termine: kept
            .filter((r) => r.date === a.date && r.status !== "cancelled")
            .map((r) => ({
              art: r.type,
              uhrzeit: r.start_time?.slice(0, 5) ?? null,
              dauer_min: r.duration_min,
              intensitaet: r.expected_intensity,
              status: r.status,
            })),
          erlaubt: {
            arten: a.kinds,
            haupteinheit: a.main,
            max_minuten: a.maxMinutes,
            max_rpe: a.maxRpe,
            unterkoerper: a.lowerBody,
            gruende: a.reasons,
          },
        })),
        ziel: {
          typ: goal.goal.type,
          beschreibung: goal.goal.aiSummary || goal.goal.description,
          zieldatum: goal.goal.targetDate,
          referenztest: goal.goal.testKey,
        },
        rahmen: {
          haupteinheiten_pro_woche: frame.extraSessionsPerWeek,
          max_minuten_pro_einheit: frame.timeBudgetMin,
          trainingsmittel: frame.equipment,
        },
        wochenlast_budget_au: budget,
        kennzahlen_heute: input.todayMetrics
          ? {
              ampel: input.todayMetrics.light,
              readiness: input.todayMetrics.readiness,
              acwr: input.todayMetrics.acwr,
              schmerz_sperren: input.todayMetrics.painSpots
                .filter((s) => s.level !== "note")
                .map((s) => ({ region: s.region, seite: s.side, stufe: s.level })),
            }
          : null,
        letzte_14_tage: kept
          .filter((r) => r.status === "done" && r.date >= addDays(today, -14) && r.date < today)
          .map((r) => ({ datum: r.date, art: r.type, dauer_min: r.duration_min, rpe: r.rpe, muedigkeit: r.fatigue })),
        gym_verlauf: await gymHistory(supabase, userId, today),
        bibliothek: library.map((e) => ({ name: e.name, geraet: e.equipment, unterkoerper: e.lowerBody })),
      };
      try {
        const ai = await aiWeekPlan(context, library, (plan) => validatePlan(aiToSessions(plan, library), ctx));
        if (ai) {
          result = { source: "ai", focus: ai.plan.focus.slice(0, 300), sessions: aiToSessions(ai.plan, library) };
          log = { context, response: ai.plan, validation: { attempts: ai.attempts, violations: ai.violations } };
        }
      } catch (error) {
        console.error("[plan] KI-Wochenplan fehlgeschlagen", error instanceof Error ? error.message : error);
      }
    }
    if (!result) {
      const items = rulesPlan(allowances, {
        goalType: goal.goal.type,
        equipment: frame.equipment,
        maxMainUnits: frame.extraSessionsPerWeek,
      });
      result = { source: "rules", focus: t(`plan.rulesFocus.${goal.goal.type}`), sessions: rulesToSessions(items, t, library) };
    }

    const enforced = enforcePlan(result.sessions, ctx);
    const adjusted =
      enforced.length !== result.sessions.length ||
      enforced.some((u, i) => u.durationMin !== result.sessions[i]?.durationMin || u.targetRpe !== result.sessions[i]?.targetRpe);

    // Alte Vorschläge ab heute ersetzen.
    if (replaced.length > 0) {
      const { error } = await supabase.from("sessions").delete().in("id", [...replacedIds]);
      if (error) throw new Error(`Alte Vorschläge nicht gelöscht: ${error.message}`);
    }
    for (const s of enforced) {
      const { data: row, error } = await supabase
        .from("sessions")
        .insert({
          user_id: userId,
          date: s.date,
          type: s.kind,
          status: "planned",
          is_fixture: false,
          duration_min: s.durationMin,
          target_rpe: s.targetRpe,
          default_rpe: s.targetRpe,
          gym_focus: s.kind === "gym" ? s.gymFocus : null,
          planned_by: result.source,
          rationale: s.reason,
          title: s.title,
        })
        .select("id")
        .single();
      if (error || !row) throw new Error(`Einheit nicht gespeichert: ${error?.message}`);
      await writeExercises(supabase, userId, row.id, s.kind, s.exercises);
    }

    if (log) {
      await supabase.from("ai_plans").insert({
        user_id: userId,
        kind: "week",
        for_date: weekStart,
        prompt_version: PROMPT_VERSION,
        model: PLAN_MODEL,
        context: log.context,
        response: log.response,
        validation: { ...(log.validation as object), adjusted, kept: enforced.length },
      });
    }
    await supabase
      .from("week_plans")
      .update({ status: "ready", source: result.source, focus: result.focus, adjusted })
      .eq("user_id", userId)
      .eq("week_start", weekStart);
    return true;
  } catch (error) {
    console.error("[plan] Woche nicht geplant", error instanceof Error ? error.message : error);
    await supabase.from("week_plans").update({ status: "failed" }).eq("user_id", userId).eq("week_start", weekStart);
    return false;
  }
}

