"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { userToday } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import { recomputeDailyMetrics } from "./metrics";
import { ROUTINE_KEYS, ROUTINES, type RoutineKey } from "./routines";

/** Routine erledigt: als absolvierte Einheit von heute eintragen (RPE wie vorgesehen). */
export async function completeRoutine(key: RoutineKey) {
  if (!(ROUTINE_KEYS as readonly string[]).includes(key)) redirect("/today");
  const user = await getCurrentUser();
  const routine = ROUTINES[key];
  const today = userToday(user.timezone);
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").insert({
    user_id: user.id,
    date: today,
    type: routine.sessionType,
    status: "done",
    is_fixture: false,
    duration_min: routine.minutes,
    default_rpe: routine.rpe,
    target_rpe: routine.rpe,
    rpe: routine.rpe,
    gym_focus: routine.sessionType === "gym" ? "full" : null,
    planned_by: "rules",
    rationale: key,
  });
  if (error) console.error("[today] Routine nicht eingetragen", error.message);
  await recomputeDailyMetrics(user.id, today, today);
  revalidatePath("/");
  revalidatePath("/today");
  redirect("/today");
}

/** Gym-Routine als geplante Gym-Einheit anlegen, um Gewichte einzutragen. */
export async function startGymRoutine() {
  const user = await getCurrentUser();
  const today = userToday(user.timezone);
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      date: today,
      type: "gym",
      status: "planned",
      is_fixture: false,
      duration_min: ROUTINES.strength_full.minutes,
      default_rpe: ROUTINES.strength_full.rpe,
      target_rpe: ROUTINES.strength_full.rpe,
      gym_focus: "full",
      planned_by: "rules",
      rationale: "strength_full",
    })
    .select("id")
    .single();
  redirect(data ? `/sessions/${data.id}` : "/today");
}
