"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { getCurrentUser } from "@/features/auth/session";
import { getGoal } from "@/features/goals/queries";
import { adjustTodayPlan, runSpareJobs } from "@/features/plan/daily";
import { computeMetricsFor, recomputeDailyMetrics } from "@/features/today/metrics";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { parseEveningPayload, parseMorningPayload } from "./schema";

export type CheckinState = { error?: string };

/** Speichert den Morgen-Check-in des heutigen Tages (anlegen oder ändern) samt Schmerzstellen. */
export async function saveMorningCheckin(
  _prev: CheckinState,
  formData: FormData,
): Promise<CheckinState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const input = parseMorningPayload(formData.get("payload"));
  if (!input) return { error: t("checkin.errorInvalid") };

  const today = userToday(user.timezone);
  const supabase = await createClient();

  const { data: checkin, error } = await supabase
    .from("checkins")
    .upsert(
      {
        user_id: user.id,
        date: today,
        kind: "morning",
        sleep_hours: input.sleepHours,
        sleep_quality: input.sleepQuality,
        energy: input.energy,
        soreness: input.soreness,
        stress: input.stress,
        resting_hr: input.restingHr,
      },
      { onConflict: "user_id,date,kind" },
    )
    .select("id")
    .single();
  if (error || !checkin) {
    console.error("[checkin] nicht gespeichert", error?.message);
    return { error: t("checkin.errorSave") };
  }

  // Schmerzstellen dieses Check-ins ersetzen.
  const { error: deleteError } = await supabase.from("pain_entries").delete().eq("checkin_id", checkin.id);
  if (!deleteError && input.pains.length > 0) {
    const { error: insertError } = await supabase.from("pain_entries").insert(
      input.pains.map((p) => ({
        user_id: user.id,
        date: today,
        checkin_id: checkin.id,
        region: p.region,
        side: p.side,
        intensity: p.intensity,
        kind: p.kind,
        swollen: p.swollen,
      })),
    );
    if (insertError) {
      console.error("[checkin] Schmerzstellen nicht gespeichert", insertError.message);
      return { error: t("checkin.errorSave") };
    }
  } else if (deleteError) {
    console.error("[checkin] alte Schmerzstellen nicht gelöscht", deleteError.message);
    return { error: t("checkin.errorSave") };
  }

  await recomputeDailyMetrics(user.id, today, today);

  // Tägliche Anpassung: heutige Vorschläge an Ampel und Schmerz anpassen (Regeln sofort,
  // Umstellung der Übungen wegen Schmerz durch die KI danach im Hintergrund).
  try {
    const [metrics, goal] = await Promise.all([computeMetricsFor(user.id, today, today), getGoal(user.id)]);
    const jobs = await adjustTodayPlan({ supabase, userId: user.id, today, metrics, goal, t });
    if (jobs.length > 0) after(() => runSpareJobs(supabase, user.id, today, jobs));
  } catch (error) {
    console.error("[checkin] Tagesanpassung fehlgeschlagen", error instanceof Error ? error.message : error);
  }
  redirect("/");
}

/** Speichert den Abend-Check-in des heutigen Tages. Fließt nur in Insights ein, nicht in die Ampel. */
export async function saveEveningCheckin(
  _prev: CheckinState,
  formData: FormData,
): Promise<CheckinState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const input = parseEveningPayload(formData.get("payload"));
  if (!input) return { error: t("evening.errorInvalid") };

  const supabase = await createClient();
  const { error } = await supabase.from("checkins").upsert(
    {
      user_id: user.id,
      date: userToday(user.timezone),
      kind: "evening",
      daily_load: input.dailyLoad,
      evening_stress: input.stress,
      evening_energy: input.energy,
      steps: input.steps,
      note: input.note || null,
    },
    { onConflict: "user_id,date,kind" },
  );
  if (error) {
    console.error("[checkin] Abend nicht gespeichert", error.message);
    return { error: t("evening.errorSave") };
  }
  redirect("/");
}
