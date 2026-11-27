import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { GymLogInput } from "./schema";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Ersetzt Übungen und Sätze einer Gym-Einheit (Gym-Log und Training-Durchlauf). */
export async function writeGymLog(supabase: Supabase, userId: string, sessionId: string, log: GymLogInput): Promise<boolean> {
  const { error: delError } = await supabase.from("session_exercises").delete().eq("session_id", sessionId);
  if (delError) return false;

  for (const [position, ex] of log.exercises.entries()) {
    const { data: row, error } = await supabase
      .from("session_exercises")
      .insert({ user_id: userId, session_id: sessionId, exercise_id: ex.exerciseId, position, note: ex.note })
      .select("id")
      .single();
    if (error || !row) {
      console.error("[gym] Übung nicht gespeichert", error?.message);
      return false;
    }
    if (ex.sets.length) {
      const { error: setError } = await supabase.from("exercise_sets").insert(
        ex.sets.map((s, i) => ({
          user_id: userId,
          session_exercise_id: row.id,
          position: i,
          weight_kg: s.weightKg,
          reps: s.reps,
          rir: s.rir,
          set_type: s.setType,
        })),
      );
      if (setError) {
        console.error("[gym] Sätze nicht gespeichert", setError.message);
        return false;
      }
    }
  }

  return true;
}
