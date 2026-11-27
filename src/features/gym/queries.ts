import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { best1rm, type GymSet } from "./logic";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  custom: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  note: string | null;
  sets: GymSet[];
}

export interface LastPerformance {
  date: string;
  sets: GymSet[];
}

interface SetRow {
  weight_kg: number | string;
  reps: number;
  rir: number | null;
  set_type: "warmup" | "working";
  position: number;
}

const toSet = (r: SetRow): GymSet => ({
  weightKg: Number(r.weight_kg),
  reps: r.reps,
  rir: r.rir,
  setType: r.set_type,
});

/** Bibliothek (global + eigene Übungen), alphabetisch. */
export async function listExercises(supabase: Supabase): Promise<Exercise[]> {
  const { data } = await supabase.from("exercises").select("id, name, muscle_group, equipment, user_id").order("name");
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscle_group,
    equipment: e.equipment,
    custom: e.user_id != null,
  }));
}

/** Übungen und Sätze einer Gym-Einheit in Reihenfolge. */
export async function loadGymLog(supabase: Supabase, sessionId: string): Promise<LoggedExercise[]> {
  const { data } = await supabase
    .from("session_exercises")
    .select("exercise_id, note, position, exercise_sets(weight_kg, reps, rir, set_type, position)")
    .eq("session_id", sessionId)
    .order("position");
  return (data ?? []).map((e) => ({
    exerciseId: e.exercise_id,
    note: e.note,
    sets: ((e.exercise_sets ?? []) as SetRow[]).sort((a, b) => a.position - b.position).map(toSet),
  }));
}

/**
 * Letzte Einheit pro Übung (vor dem Datum, ohne die aktuelle Einheit) – für Vorbelegung,
 * Vorschlag und „Letztes Mal“. Liefert eine Map exerciseId → Leistung.
 */
export async function lastPerformances(
  supabase: Supabase,
  userId: string,
  exerciseIds: string[],
  excludeSessionId: string,
  beforeOrOn: string,
): Promise<Record<string, LastPerformance>> {
  if (exerciseIds.length === 0) return {};
  const { data } = await supabase
    .from("session_exercises")
    .select("exercise_id, session_id, sessions!inner(date), exercise_sets(weight_kg, reps, rir, set_type, position)")
    .eq("user_id", userId)
    .in("exercise_id", exerciseIds)
    .neq("session_id", excludeSessionId)
    .lte("sessions.date", beforeOrOn)
    .limit(200);

  const result: Record<string, LastPerformance> = {};
  for (const row of data ?? []) {
    const session = row.sessions as unknown as { date: string } | { date: string }[];
    const date = Array.isArray(session) ? session[0]?.date : session?.date;
    const sets = ((row.exercise_sets ?? []) as SetRow[]).sort((a, b) => a.position - b.position).map(toSet);
    if (!date || sets.length === 0) continue;
    const current = result[row.exercise_id];
    if (!current || date > current.date) result[row.exercise_id] = { date, sets };
  }
  return result;
}

/** Bisher bestes geschätztes 1RM pro Übung (alle Einheiten außer der aktuellen) – für Bestwerte. */
export async function bestE1rms(
  supabase: Supabase,
  userId: string,
  exerciseIds: string[],
  excludeSessionId: string,
): Promise<Record<string, number>> {
  if (exerciseIds.length === 0) return {};
  const { data } = await supabase
    .from("session_exercises")
    .select("exercise_id, session_id, exercise_sets(weight_kg, reps, rir, set_type, position)")
    .eq("user_id", userId)
    .in("exercise_id", exerciseIds)
    .neq("session_id", excludeSessionId)
    .limit(500);
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const best = best1rm(((row.exercise_sets ?? []) as SetRow[]).map(toSet));
    if (best > (out[row.exercise_id] ?? 0)) out[row.exercise_id] = best;
  }
  return out;
}
