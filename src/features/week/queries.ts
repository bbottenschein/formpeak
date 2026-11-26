import "server-only";
import {
  addDays,
  matchdayContext,
  matchdayLabel,
  plannedLoad,
  sessionHints,
  weekHints,
  type DailyMetrics,
  type SessionHint,
  type WeekHint,
} from "@/core/load";
import { ensureFixtures, loadSessions, toCoreSession, type SessionRow } from "@/features/sessions/data";
import { createClient } from "@/lib/supabase/server";

export interface WeekSession extends SessionRow {
  hints: SessionHint[];
  feedbackDue: boolean;
}

export interface WeekDay {
  date: string;
  mdLabel: string | null;
  sessions: WeekSession[];
}

export interface WeekData {
  monday: string;
  days: WeekDay[];
  hints: WeekHint[];
  plannedLoad: number;
  hasSeries: boolean;
}

/**
 * Woche (Mo–So) mit Spieltagslogik und Hinweisen. Die Ampel fließt nur für heute ein
 * (`todayMetrics`), für andere Tage gibt es noch keine.
 */
export async function getWeek(
  userId: string,
  monday: string,
  today: string,
  todayMetrics: DailyMetrics | null,
): Promise<WeekData> {
  const supabase = await createClient();
  // Eine Woche davor (Vorwochenlast, MD+n) und eine danach (nächstes Spiel, MD−n).
  const from = addDays(monday, -7);
  const to = addDays(monday, 13);
  await ensureFixtures(supabase, userId, from, to);
  const rows = await loadSessions(supabase, userId, from, to);
  const core = rows.map(toCoreSession);

  const { count } = await supabase
    .from("fixture_series")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const matchDates = rows.filter((r) => r.type === "match" && r.status !== "cancelled").map((r) => r.date);

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const isToday = date === today;
    const sessions = rows
      .map((r, j) => ({ r, coreSession: core[j] }))
      .filter(({ r }) => r.date === date)
      .map(({ r, coreSession }): WeekSession => {
        return {
          ...r,
          hints:
            r.status === "planned"
              ? sessionHints(coreSession, {
                  sessions: core,
                  light: isToday ? todayMetrics?.light : undefined,
                  painSpots: isToday ? todayMetrics?.painSpots : undefined,
                })
              : [],
          feedbackDue: r.status === "planned" && date <= today,
        };
      });
    return { date, mdLabel: matchdayLabel(matchdayContext(date, matchDates)), sessions };
  });

  const weekSessions = core.filter((s) => s.date >= monday && s.date <= addDays(monday, 6));
  return {
    monday,
    days,
    hints: weekHints(monday, core, today),
    plannedLoad: weekSessions
      .filter((s) => s.status !== "cancelled")
      .reduce((sum, s) => sum + plannedLoad(s), 0),
    hasSeries: (count ?? 0) > 0,
  };
}
