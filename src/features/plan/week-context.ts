import "server-only";
import { addDays, dayAllowances, mondayOf, offseasonWeek, type PlanCheckContext, type PlanUnit, type TrafficLight } from "@/core/load";
import type { GoalData } from "@/features/goals/queries";
import { getOffseason } from "@/features/offseason/queries";
import { isOpenSuggestion, loadSessions, toCoreSession, type SessionRow } from "@/features/sessions/data";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const isOpenPlan = (r: SessionRow) => isOpenSuggestion(r);

/**
 * Rahmen einer Woche für Änderungen an einzelnen Vorschlägen (verschieben, tauschen):
 * Leitplanken pro Tag, Prüfkontext ohne die offenen Vorschläge und diese als Plan-Einheiten.
 */
export async function loadWeekContext(
  supabase: Supabase,
  userId: string,
  date: string,
  today: string,
  goal: GoalData,
  todayLight?: TrafficLight,
) {
  const monday = mondayOf(date);
  const firstDay = monday > today ? monday : today;
  const off = await getOffseason(supabase, userId, firstDay);
  const offWeek = off ? offseasonWeek(off.phase, firstDay) : undefined;
  const frame = off?.frame ?? goal.frame;
  if (!frame) return null;

  const rows = await loadSessions(supabase, userId, addDays(monday, -28), addDays(monday, 13));
  const inWeek = (r: SessionRow) => r.date >= monday && r.date <= addDays(monday, 6);
  const planRows = rows.filter((r) => isOpenPlan(r) && inWeek(r));
  const sessions = rows.filter((r) => !planRows.includes(r)).map(toCoreSession);
  const allowances = dayAllowances({
    weekStart: monday,
    today,
    sessions,
    availableWeekdays: frame.availableWeekdays,
    timeBudgetMin: frame.timeBudgetMin,
    todayLight: today >= monday && today <= addDays(monday, 6) ? todayLight : undefined,
    offseason: offWeek,
  });
  const ctx: PlanCheckContext = { allowances, sessions, maxMainUnits: frame.extraSessionsPerWeek, today, offseason: offWeek };

  // Unterkörper aus der Bibliothek der geplanten Übungen.
  const { data: ex } = planRows.length
    ? await supabase.from("planned_exercises").select("session_id, exercises(lower_body)").in("session_id", planRows.map((r) => r.id))
    : { data: [] };
  const lower = new Set(
    (ex ?? [])
      .filter((e) => (e.exercises as unknown as { lower_body: boolean } | null)?.lower_body)
      .map((e) => e.session_id as string),
  );
  const unitOf = (r: SessionRow): PlanUnit => ({
    date: r.date,
    kind: r.type as PlanUnit["kind"],
    durationMin: r.duration_min,
    targetRpe: r.target_rpe ?? r.default_rpe,
    lowerBody: lower.has(r.id),
    focus: r.focus as PlanUnit["focus"],
  });
  return { monday, off, offWeek, frame, allowances, ctx, planRows, unitOf };
}
