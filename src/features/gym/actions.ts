"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/session";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { lastPerformances, type LastPerformance } from "./queries";
import { customExerciseSchema, gymLogSchema } from "./schema";

export type GymLogState = { error?: string; savedAt?: number };

/** Ersetzt Übungen und Sätze einer Gym-Einheit. */
export async function saveGymLog(sessionId: string, _prev: GymLogState, formData: FormData): Promise<GymLogState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  let parsed;
  try {
    parsed = gymLogSchema.safeParse(JSON.parse(String(formData.get("payload") ?? "")));
  } catch {
    return { error: t("gym.errorInvalid") };
  }
  if (!parsed.success) return { error: t("gym.errorInvalid") };

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("id, type")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!session || session.type !== "gym") return { error: t("gym.errorSave") };

  const { error: delError } = await supabase.from("session_exercises").delete().eq("session_id", sessionId);
  if (delError) return { error: t("gym.errorSave") };

  for (const [position, ex] of parsed.data.exercises.entries()) {
    const { data: row, error } = await supabase
      .from("session_exercises")
      .insert({ user_id: user.id, session_id: sessionId, exercise_id: ex.exerciseId, position, note: ex.note })
      .select("id")
      .single();
    if (error || !row) {
      console.error("[gym] Übung nicht gespeichert", error?.message);
      return { error: t("gym.errorSave") };
    }
    if (ex.sets.length) {
      const { error: setError } = await supabase.from("exercise_sets").insert(
        ex.sets.map((s, i) => ({
          user_id: user.id,
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
        return { error: t("gym.errorSave") };
      }
    }
  }

  revalidatePath(`/sessions/${sessionId}`);
  return { savedAt: Date.now() };
}

/** Letzte Leistung einer Übung – beim Hinzufügen einer Übung im Log. */
export async function fetchLastPerformance(
  exerciseId: string,
  sessionId: string,
): Promise<LastPerformance | null> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const map = await lastPerformances(supabase, user.id, [exerciseId], sessionId, userToday(user.timezone));
  return map[exerciseId] ?? null;
}

export type CustomExerciseResult = { error?: string; exercise?: { id: string; name: string; muscleGroup: string; equipment: string } };

/** Eigene Übung anlegen (nur für den Nutzer sichtbar). */
export async function createCustomExercise(input: {
  name: string;
  muscleGroup: string;
  equipment: string;
}): Promise<CustomExerciseResult> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const parsed = customExerciseSchema.safeParse(input);
  if (!parsed.success) return { error: t("gym.errorInvalid") };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      muscle_group: parsed.data.muscleGroup,
      equipment: parsed.data.equipment,
      lower_body: ["legs", "posterior_chain", "adductors", "calves"].includes(parsed.data.muscleGroup),
    })
    .select("id, name, muscle_group, equipment")
    .single();
  if (error || !data) return { error: t("gym.errorSave") };
  return { exercise: { id: data.id, name: data.name, muscleGroup: data.muscle_group, equipment: data.equipment } };
}
