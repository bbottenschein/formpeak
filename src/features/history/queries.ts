import "server-only";
import { addDays } from "@/core/load";
import { createClient } from "@/lib/supabase/server";
import type { LoggedSet, PainRecord } from "./logic";

export interface WellbeingPoint {
  date: string;
  sleepHours: number | null;
  energy: number | null;
  stress: number | null;
  soreness: number | null;
}

/** Alle Daten für den Verlauf (Zeitraum `days` Tage bis heute). */
export async function getHistory(userId: string, today: string, days: number) {
  const supabase = await createClient();
  const from = addDays(today, -(days - 1));

  const [checkins, pains, gym] = await Promise.all([
    supabase
      .from("checkins")
      .select("date, sleep_hours, energy, soreness, stress")
      .eq("user_id", userId)
      .eq("kind", "morning")
      .gte("date", from)
      .lte("date", today),
    supabase
      .from("pain_entries")
      .select("date, region, side, intensity")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", today),
    supabase
      .from("session_exercises")
      .select("exercise_id, exercises(name, muscle_group), sessions!inner(date), exercise_sets(weight_kg, reps, rir, set_type)")
      .eq("user_id", userId)
      .gte("sessions.date", addDays(today, -365))
      .lte("sessions.date", today),
  ]);

  const byDate = new Map((checkins.data ?? []).map((c) => [c.date, c]));
  const wellbeing: WellbeingPoint[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const c = byDate.get(d);
    wellbeing.push({
      date: d,
      sleepHours: c ? Number(c.sleep_hours) : null,
      energy: c?.energy ?? null,
      stress: c?.stress ?? null,
      soreness: c?.soreness ?? null,
    });
  }

  const one = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? (x[0] ?? null) : x);
  const sets: LoggedSet[] = [];
  const exerciseNames: Record<string, string> = {};
  for (const row of gym.data ?? []) {
    const ex = one(row.exercises as unknown as { name: string; muscle_group: string } | null);
    const session = one(row.sessions as unknown as { date: string } | null);
    if (!ex || !session) continue;
    exerciseNames[row.exercise_id] = ex.name;
    for (const s of (row.exercise_sets ?? []) as { weight_kg: number | string; reps: number; rir: number | null; set_type: "warmup" | "working" }[]) {
      sets.push({
        date: session.date,
        exerciseId: row.exercise_id,
        muscleGroup: ex.muscle_group,
        weightKg: Number(s.weight_kg),
        reps: s.reps,
        rir: s.rir,
        setType: s.set_type,
      });
    }
  }

  return {
    from,
    wellbeing,
    pains: (pains.data ?? []) as PainRecord[],
    sets,
    exerciseNames,
  };
}
