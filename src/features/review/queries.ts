import "server-only";
import { addDays, type IsoDate } from "@/core/load";
import { best1rm, type GymSet } from "@/features/gym/logic";
import { loadSessions, toCoreSession } from "@/features/sessions/data";
import type { createClient } from "@/lib/supabase/server";
import { checkinStreak, completionRate, reviewStats, type ReviewStats } from "./logic";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type ReviewKind = "week" | "month";

export interface ReviewData {
  kind: ReviewKind;
  from: IsoDate;
  to: IsoDate;
  stats: ReviewStats;
  /** Neue Bestwerte im Zeitraum (geschätztes 1RM). */
  bests: { name: string; e1rm: number }[];
  /** Referenztests im Zeitraum. */
  tests: { key: string; value: number }[];
}

/** Ende (exklusiv) eines Zeitraums: Woche = 7 Tage, Monat = 1. des Folgemonats. */
export function periodEnd(kind: ReviewKind, from: IsoDate): IsoDate {
  if (kind === "week") return addDays(from, 7);
  const [y, m] = from.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Monatsanfang des Vormonats bzw. Montag der Rückblick-Woche. */
export function previousMonthStart(today: IsoDate): IsoDate {
  const [y, m] = today.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

interface SetRow {
  weight_kg: number | string;
  reps: number;
  rir: number | null;
  set_type: "warmup" | "working";
}

export async function getReviewData(supabase: Supabase, userId: string, kind: ReviewKind, from: IsoDate, today: IsoDate): Promise<ReviewData> {
  const to = periodEnd(kind, from);
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  const [rows, { data: checkins }, { data: gym }, { data: tests }] = await Promise.all([
    loadSessions(supabase, userId, addDays(from, -days), addDays(to, -1)),
    supabase.from("checkins").select("date").eq("user_id", userId).eq("kind", "morning").gte("date", from).lt("date", to),
    supabase
      .from("session_exercises")
      .select("exercise_id, exercises(name), sessions!inner(date, status), exercise_sets(weight_kg, reps, rir, set_type)")
      .eq("user_id", userId)
      .lt("sessions.date", to)
      .limit(1000),
    supabase.from("goal_tests").select("test_key, value, date").eq("user_id", userId).eq("status", "done").gte("date", from).lt("date", to),
  ]);

  const sessions = rows.map((r) => ({ ...toCoreSession(r), adjusted: r.adjustment != null }));
  const stats = reviewStats(sessions, (checkins ?? []).map((c) => c.date), from, to, today);

  // Bestwerte: bestes 1RM im Zeitraum über dem besten davor (erstes Mal zählt nicht).
  const before = new Map<string, number>();
  const during = new Map<string, { name: string; e1rm: number }>();
  for (const g of gym ?? []) {
    const s = g.sessions as unknown as { date: string; status: string };
    if (s.status !== "done") continue;
    const e1rm = best1rm(
      ((g.exercise_sets ?? []) as SetRow[]).map((x): GymSet => ({ weightKg: Number(x.weight_kg), reps: x.reps, rir: x.rir, setType: x.set_type })),
    );
    if (s.date < from) before.set(g.exercise_id, Math.max(before.get(g.exercise_id) ?? 0, e1rm));
    else if (e1rm > (during.get(g.exercise_id)?.e1rm ?? 0)) {
      during.set(g.exercise_id, { name: (g.exercises as unknown as { name: string } | null)?.name ?? "", e1rm });
    }
  }
  const bests = [...during.entries()]
    .filter(([id, v]) => (before.get(id) ?? 0) > 0 && v.e1rm > before.get(id)!)
    .map(([, v]) => v);

  return { kind, from, to, stats, bests, tests: (tests ?? []).map((x) => ({ key: x.test_key as string, value: Number(x.value) })) };
}

/** Check-in-Serie und Anteil erledigter Vorschläge der letzten 4 Wochen (für Home). */
export async function getConsistency(supabase: Supabase, userId: string, today: IsoDate) {
  const from = addDays(today, -28);
  const [{ data: checkins }, rows] = await Promise.all([
    supabase.from("checkins").select("date").eq("user_id", userId).eq("kind", "morning").gte("date", addDays(today, -120)),
    loadSessions(supabase, userId, from, today),
  ]);
  return {
    streak: checkinStreak((checkins ?? []).map((c) => c.date), today),
    rate: completionRate(
      rows.map((r) => ({
        date: r.date,
        status: r.status,
        suggested: r.planned_by === "ai" || r.planned_by === "rules",
        adjusted: r.adjustment != null,
      })),
      from,
      today,
      today,
    ),
  };
}
