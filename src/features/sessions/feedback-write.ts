import "server-only";
import { isIntense } from "@/core/load";
import { computeMetricsFor, recomputeDailyMetrics } from "@/features/today/metrics";
import { createClient } from "@/lib/supabase/server";
import { toCoreSession, type SessionRow } from "./data";
import type { FeedbackInput } from "./schema";

/**
 * Schreibt das Feedback einer Einheit (Status erledigt, RPE, Müdigkeit, Schmerzstellen) und
 * rechnet die Kennzahlen neu. Gemeinsam genutzt vom Feedback-Formular und vom Training-Durchlauf.
 */
export async function applyFeedback(userId: string, session: SessionRow, input: FeedbackInput, today: string): Promise<boolean> {
  const sessionId = session.id;
  // Protokollieren, wenn an einem roten Tag intensiv trainiert wurde.
  let against = false;
  if (session.date === today) {
    const metrics = await computeMetricsFor(userId, today, today);
    against =
      metrics.light === "red" &&
      isIntense({ ...toCoreSession(session), status: "done", rpe: input.rpe });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      status: "done",
      duration_min: input.durationMin,
      rpe: input.rpe,
      fatigue: input.fatigue,
      match_minutes: session.type === "match" ? input.matchMinutes : null,
      against_recommendation: against,
    })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) {
    console.error("[sessions] Feedback nicht gespeichert", error.message);
    return false;
  }

  const { error: delError } = await supabase.from("pain_entries").delete().eq("session_id", sessionId);
  if (!delError && input.pains.length) {
    const { error: painError } = await supabase.from("pain_entries").insert(
      input.pains.map((p) => ({
        user_id: userId,
        date: session.date,
        session_id: sessionId,
        region: p.region,
        side: p.side,
        intensity: p.intensity,
        kind: p.kind,
        swollen: p.swollen,
      })),
    );
    if (painError) console.error("[sessions] Schmerzstellen nicht gespeichert", painError.message);
  }

  await recomputeDailyMetrics(userId, today, today);
  return true;
}
