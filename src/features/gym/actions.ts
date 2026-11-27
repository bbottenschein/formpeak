"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/session";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { lastPerformances, type LastPerformance } from "./queries";
import { writeGymLog } from "./write";
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

  if (!(await writeGymLog(supabase, user.id, sessionId, parsed.data))) return { error: t("gym.errorSave") };

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
