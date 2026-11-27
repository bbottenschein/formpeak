"use server";

import { revalidatePath } from "next/cache";
import { addDays, dateRange, findMoveDate, isMainUnit, validatePlan } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { getGoal } from "@/features/goals/queries";
import { isOpenSuggestion, SESSION_COLUMNS, type SessionRow } from "@/features/sessions/data";
import { computeMetricsFor } from "@/features/today/metrics";
import { ROUTINES, type RoutineKey } from "@/features/today/routines";
import { hasAnthropicKey } from "@/lib/env.server";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { aiAlternative } from "./ai";
import { BASIS_KEYS } from "./basis";
import { aiUnitToSession, loadLibrary, rulesToSessions, writeExercises } from "./generate";
import { rulesAlternative } from "./rules-plan";
import type { PlannedSession } from "./types";
import { loadWeekContext } from "./week-context";

function refresh(id: string) {
  for (const p of ["/", "/today", "/week", `/sessions/${id}`]) revalidatePath(p);
}

async function openPlanSession(id: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("sessions").select(SESSION_COLUMNS).eq("id", id).eq("user_id", user.id).maybeSingle();
  const row = data as SessionRow | null;
  const ok = row && isOpenSuggestion(row);
  return { user, supabase, row: ok ? row : null };
}

/**
 * „Heute keine Zeit“: auf den nächsten Tag dieser Woche verschieben, an dem die Einheit in die
 * Leitplanken passt. Kein passender Tag → nichts ändern, die Oberfläche bietet „Streichen“ an.
 */
export async function postponeSession(id: string): Promise<{ movedTo?: string; none?: boolean; dropped?: boolean }> {
  const { user, supabase, row } = await openPlanSession(id);
  if (!row) return { none: true };
  const today = userToday(user.timezone);
  const wc = await loadWeekContext(supabase, user.id, row.date, today, await getGoal(user.id));
  if (!wc) return { none: true };
  // Kurze, leichte Einheiten (Mobilität, Aktivierung, Regeneration) hängen am Tag – sie entfallen einfach.
  if (!isMainUnit(wc.unitOf(row))) {
    await supabase.from("sessions").update({ status: "cancelled" }).eq("id", id).eq("user_id", user.id);
    refresh(id);
    return { dropped: true };
  }
  const start = row.date > today ? row.date : today;
  const candidates = dateRange(addDays(start, 1), addDays(wc.monday, 6));
  const others = wc.planRows.filter((r) => r.id !== row.id).map(wc.unitOf);
  const date = findMoveDate(wc.unitOf(row), others, wc.ctx, candidates);
  if (!date) return { none: true };
  await supabase.from("sessions").update({ date }).eq("id", id).eq("user_id", user.id);
  refresh(id);
  return { movedTo: date };
}

/**
 * „Lieber etwas anderes“: Alternative im gleichen Tagesrahmen – mit KI, sonst aus der
 * Routinen-Bibliothek. Pflichtinhalte (Sprint, Prävention) bleiben erhalten.
 */
export async function swapSession(id: string): Promise<{ ok: boolean }> {
  const { user, supabase, row } = await openPlanSession(id);
  if (!row) return { ok: false };
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const goal = await getGoal(user.id);
  const light = row.date === today ? (await computeMetricsFor(user.id, today, today)).light : undefined;
  const wc = await loadWeekContext(supabase, user.id, row.date, today, goal, light);
  const allowance = wc?.allowances.find((a) => a.date === row.date);
  if (!wc || !allowance || allowance.kinds.length === 0) return { ok: false };

  const library = await loadLibrary(supabase);
  const others = wc.planRows.filter((r) => r.id !== row.id).map(wc.unitOf);
  const keep = row.focus.filter((f) => f === "sprint" || f === "prevention");
  const fitsRules = (s: PlannedSession) => {
    const units = [...others, s];
    return !validatePlan(units, wc.ctx).some((v) => "index" in v && v.index === units.length - 1) &&
      keep.every((f) => s.focus?.includes(f as never));
  };

  let next: PlannedSession | null = null;
  let source: "ai" | "rules" = "rules";
  if (hasAnthropicKey()) {
    try {
      const unit = await aiAlternative(
        {
          datum: row.date,
          bisher: { titel: row.title, art: row.type, dauer_min: row.duration_min, ziel_rpe: row.target_rpe, focus: row.focus },
          behalten: keep,
          erlaubt: {
            arten: allowance.kinds,
            haupteinheit: allowance.main,
            max_minuten: allowance.maxMinutes,
            max_rpe: allowance.maxRpe,
            unterkoerper: allowance.lowerBody,
          },
          ziel: goal.goal ? { schwerpunkte: goal.goal.focuses, beschreibung: goal.goal.aiSummary || goal.goal.description } : null,
          off_season: wc.offWeek ? { abschnitt: wc.offWeek.block, entlastungswoche: wc.offWeek.deload } : null,
          trainingsmittel: wc.frame.equipment,
          bibliothek: library.map((e) => ({ name: e.name, geraet: e.equipment, unterkoerper: e.lowerBody })),
          grundlagen: Object.fromEntries(BASIS_KEYS.map((k) => [k, t(`basis.${k}`)])),
        },
        library,
      );
      const s = unit ? aiUnitToSession({ ...unit, date: row.date }, library) : null;
      if (s && fitsRules(s)) {
        next = s;
        source = "ai";
      }
    } catch (error) {
      console.error("[plan] Alternative per KI fehlgeschlagen", error instanceof Error ? error.message : error);
    }
  }
  if (!next) {
    const routineKey = (Object.keys(ROUTINES) as RoutineKey[]).find((k) => t(`routines.titles.${k}`) === row.title) ?? null;
    const alt = rulesAlternative(allowance, { routineKey, title: row.title ?? "", focus: row.focus }, wc.frame.equipment, (k) => t(`routines.titles.${k}`));
    if (!alt) return { ok: false };
    const r = ROUTINES[alt];
    [next] = rulesToSessions(
      [{ date: row.date, routine: alt, durationMin: Math.min(r.minutes, allowance.maxMinutes), targetRpe: Math.min(r.rpe, allowance.maxRpe), lowerBody: alt === "strength_full" }],
      t,
      library,
    );
  }

  await supabase
    .from("sessions")
    .update({
      type: next.kind,
      title: next.title,
      rationale: next.reason,
      duration_min: Math.min(next.durationMin, allowance.maxMinutes),
      target_rpe: Math.min(next.targetRpe, allowance.maxRpe),
      default_rpe: Math.min(next.targetRpe, allowance.maxRpe),
      gym_focus: next.kind === "gym" ? next.gymFocus : null,
      planned_by: source,
      basis: next.basis,
      focus: next.focus ?? [],
    })
    .eq("id", id)
    .eq("user_id", user.id);
  await writeExercises(supabase, user.id, id, next.kind, next.exercises);
  refresh(id);
  return { ok: true };
}
