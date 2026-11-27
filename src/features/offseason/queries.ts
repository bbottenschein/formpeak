import "server-only";
import type { OffseasonPhase } from "@/core/load";
import type { GoalData } from "@/features/goals/queries";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Frame = NonNullable<GoalData["frame"]>;

export interface Offseason {
  id: string;
  phase: OffseasonPhase;
  /** Rahmen während der Pause (ersetzt den Saison-Rahmen). */
  frame: Frame;
}

const COLUMNS = "id, starts_on, ends_on, recovery_weeks, extra_sessions_per_week, available_weekdays, time_budget_min, equipment";

interface Row {
  id: string;
  starts_on: string;
  ends_on: string | null;
  recovery_weeks: number;
  extra_sessions_per_week: number | null;
  available_weekdays: number[];
  time_budget_min: number | null;
  equipment: string[];
}

const toOffseason = (r: Row): Offseason => ({
  id: r.id,
  phase: { startsOn: r.starts_on, endsOn: r.ends_on, recoveryWeeks: r.recovery_weeks },
  frame: {
    extraSessionsPerWeek: r.extra_sessions_per_week ?? 0,
    availableWeekdays: r.available_weekdays,
    timeBudgetMin: r.time_budget_min ?? 60,
    equipment: r.equipment as Frame["equipment"],
  },
});

/** Pause, in der das Datum liegt (Off-Season-Modus), sonst null (Season-Modus). */
export async function getOffseason(supabase: Supabase, userId: string, date: string): Promise<Offseason | null> {
  const { data } = await supabase
    .from("season_phases")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("kind", "break")
    .lte("starts_on", date)
    .or(`ends_on.is.null,ends_on.gte.${date}`)
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toOffseason(data as Row) : null;
}

/** Alle Pausen, die den Zeitraum berühren (für das Pausieren fester Termine). */
export async function breakPhases(supabase: Supabase, userId: string, from: string, to: string): Promise<OffseasonPhase[]> {
  const { data } = await supabase
    .from("season_phases")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("kind", "break")
    .lte("starts_on", to)
    .or(`ends_on.is.null,ends_on.gte.${from}`);
  return ((data ?? []) as Row[]).map((r) => toOffseason(r).phase);
}
