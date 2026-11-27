"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/features/auth/session";
import { gymLogSchema } from "@/features/gym/schema";
import { writeGymLog } from "@/features/gym/write";
import { SESSION_COLUMNS, type SessionRow } from "@/features/sessions/data";
import { applyFeedback } from "@/features/sessions/feedback-write";
import { feedbackSchema } from "@/features/sessions/schema";
import { ROUTINE_KEYS, ROUTINES, type RoutineKey } from "@/features/today/routines";
import { recomputeDailyMetrics } from "@/features/today/metrics";
import { userToday } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

const finishSchema = z.object({ feedback: feedbackSchema, gym: gymLogSchema.nullable() });
export type FinishPayload = z.input<typeof finishSchema>;

function refresh() {
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/week");
}

/**
 * Training abgeschlossen: Gym-Sätze und Feedback in einem Schritt speichern. Wird eine geplante
 * Einheit früher oder später absolviert, wandert sie auf heute.
 */
export async function finishTraining(sessionId: string, payload: FinishPayload): Promise<{ error?: boolean }> {
  const parsed = finishSchema.safeParse(payload);
  if (!parsed.success) return { error: true };
  const user = await getCurrentUser();
  const today = userToday(user.timezone);
  const supabase = await createClient();
  const { data } = await supabase.from("sessions").select(SESSION_COLUMNS).eq("id", sessionId).eq("user_id", user.id).maybeSingle();
  let session = data as SessionRow | null;
  if (!session || session.status === "cancelled") return { error: true };

  if (session.date !== today && session.status === "planned") {
    await supabase.from("sessions").update({ date: today }).eq("id", sessionId).eq("user_id", user.id);
    await recomputeDailyMetrics(user.id, session.date < today ? session.date : today, today);
    session = { ...session, date: today };
  }
  if (session.type === "gym" && parsed.data.gym && parsed.data.gym.exercises.length > 0) {
    if (!(await writeGymLog(supabase, user.id, sessionId, parsed.data.gym))) return { error: true };
  }
  if (!(await applyFeedback(user.id, session, parsed.data.feedback, today))) return { error: true };
  refresh();
  redirect("/today");
}

/** Routine ohne Plan (kein Ziel): als absolvierte Einheit von heute eintragen. */
export async function finishRoutine(key: string, payload: FinishPayload): Promise<{ error?: boolean }> {
  const parsed = finishSchema.safeParse(payload);
  if (!parsed.success || !(ROUTINE_KEYS as readonly string[]).includes(key)) return { error: true };
  const user = await getCurrentUser();
  const today = userToday(user.timezone);
  const routine = ROUTINES[key as RoutineKey];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      date: today,
      type: routine.sessionType,
      status: "planned",
      is_fixture: false,
      duration_min: routine.minutes,
      default_rpe: routine.rpe,
      target_rpe: routine.rpe,
      gym_focus: routine.sessionType === "gym" ? "full" : null,
      planned_by: "rules",
      rationale: key,
    })
    .select(SESSION_COLUMNS)
    .single();
  if (error || !data) return { error: true };
  const session = data as SessionRow;
  if (session.type === "gym" && parsed.data.gym && parsed.data.gym.exercises.length > 0) {
    await writeGymLog(supabase, user.id, session.id, parsed.data.gym);
  }
  if (!(await applyFeedback(user.id, session, parsed.data.feedback, today))) return { error: true };
  refresh();
  redirect("/today");
}
