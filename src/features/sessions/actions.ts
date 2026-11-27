"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isIntense } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { DEFAULT_RPE, RPE_FOR_INTENSITY } from "@/features/calendar/series";
import { computeMetricsFor, recomputeDailyMetrics } from "@/features/today/metrics";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { SESSION_COLUMNS, toCoreSession, type SessionRow } from "./data";
import { applyFeedback } from "./feedback-write";
import { feedbackSchema, newSessionSchema, parseJsonField } from "./schema";

export type SessionFormState = { error?: string };

function refresh() {
  revalidatePath("/");
  revalidatePath("/week");
}

/** Neue Einheit: selbst geplante Zusatzeinheit oder Einzeltermin (Training/Spiel). */
export async function createSession(_prev: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const input = parseJsonField(newSessionSchema, formData.get("payload"));
  if (!input) return { error: t("session.errorInvalid") };

  const fixture = input.type === "training" || input.type === "match";
  const intensity = fixture ? (input.expectedIntensity ?? (input.type === "match" ? "high" : "medium")) : null;
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").insert({
    user_id: user.id,
    date: input.date,
    start_time: input.startTime,
    type: input.type,
    status: "planned",
    is_fixture: fixture,
    expected_intensity: intensity,
    gym_focus: input.gymFocus,
    duration_min: input.durationMin,
    target_rpe: fixture ? null : input.targetRpe,
    default_rpe:
      input.type === "match"
        ? DEFAULT_RPE.match
        : intensity
          ? RPE_FOR_INTENSITY[intensity]
          : (input.targetRpe ?? DEFAULT_RPE[input.type]),
    planned_by: "user",
    notes: input.notes,
  });
  if (error) {
    console.error("[sessions] nicht gespeichert", error.message);
    return { error: t("session.errorSave") };
  }
  const today = userToday(user.timezone);
  if (input.date <= today) await recomputeDailyMetrics(user.id, today, today);
  refresh();
  redirect(`/week?start=${input.date}`);
}

async function ownSession(id: string, userId: string): Promise<SessionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as SessionRow | null) ?? null;
}

/** Feedback nach der Einheit: Dauer, RPE, Müdigkeit, Spielminuten, Schmerzstellen. */
export async function saveFeedback(
  sessionId: string,
  _prev: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const input = parseJsonField(feedbackSchema, formData.get("payload"));
  const session = await ownSession(sessionId, user.id);
  if (!input || !session) return { error: t("session.errorInvalid") };
  const today = userToday(user.timezone);
  if (session.date > today) return { error: t("session.futureFeedback") };

  if (!(await applyFeedback(user.id, session, input, today))) return { error: t("session.errorSave") };

  await recomputeDailyMetrics(user.id, today, today);
  refresh();
  redirect(`/week?start=${session.date}`);
}

async function updateAndBack(sessionId: string, patch: Record<string, unknown>) {
  const user = await getCurrentUser();
  const session = await ownSession(sessionId, user.id);
  if (!session) redirect("/week");
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").update(patch).eq("id", sessionId).eq("user_id", user.id);
  if (error) console.error("[sessions] Änderung nicht gespeichert", error.message);
  const today = userToday(user.timezone);
  await recomputeDailyMetrics(user.id, today, today);
  refresh();
  redirect(`/week?start=${(patch.date as string | undefined) ?? session.date}`);
}

export async function cancelSession(sessionId: string) {
  await updateAndBack(sessionId, { status: "cancelled" });
}

export async function restoreSession(sessionId: string) {
  await updateAndBack(sessionId, { status: "planned", rpe: null, fatigue: null, match_minutes: null });
}

export async function moveSession(sessionId: string, formData: FormData) {
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect(`/sessions/${sessionId}`);
  await updateAndBack(sessionId, { date });
}

/** Löschen nur für Einheiten ohne Serie (Serientermine werden abgesagt, nicht gelöscht). */
export async function deleteSession(sessionId: string) {
  const user = await getCurrentUser();
  const session = await ownSession(sessionId, user.id);
  if (!session || session.series_id) redirect(`/sessions/${sessionId}`);
  const supabase = await createClient();
  await supabase.from("sessions").delete().eq("id", sessionId).eq("user_id", user.id);
  const today = userToday(user.timezone);
  await recomputeDailyMetrics(user.id, today, today);
  refresh();
  redirect(`/week?start=${session.date}`);
}

/** Schnelles Feedback aus der Übersicht: nur RPE, Dauer bleibt wie geplant. */
export async function quickFeedback(sessionId: string, rpe: number): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!Number.isInteger(rpe) || rpe < 0 || rpe > 10) return { ok: false };
  const session = await ownSession(sessionId, user.id);
  const today = userToday(user.timezone);
  if (!session || session.date > today || session.status === "cancelled") return { ok: false };

  let against = false;
  if (session.date === today) {
    const metrics = await computeMetricsFor(user.id, today, today);
    against = metrics.light === "red" && isIntense({ ...toCoreSession(session), status: "done", rpe });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ status: "done", rpe, against_recommendation: against })
    .eq("id", sessionId)
    .eq("user_id", user.id);
  if (error) {
    console.error("[sessions] Schnell-Feedback nicht gespeichert", error.message);
    return { ok: false };
  }
  await recomputeDailyMetrics(user.id, today, today);
  refresh();
  return { ok: true };
}
