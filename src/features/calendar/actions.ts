"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/features/auth/session";
import { recomputeDailyMetrics } from "@/features/today/metrics";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const seriesSchema = z
  .object({
    kind: z.enum(["training", "match"]),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    durationMin: z.number().int().min(15).max(300),
    expectedIntensity: z.enum(["low", "medium", "high"]),
    defaultRpe: z.number().int().min(0).max(10),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    validUntil: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .refine((s) => s.validUntil == null || s.validUntil >= s.validFrom);

export type SeriesState = { error?: string; ok?: boolean };

export async function createSeries(_prev: SeriesState, formData: FormData): Promise<SeriesState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const parsed = seriesSchema.safeParse({
    kind: str("kind"),
    weekdays: formData.getAll("weekdays").map(Number),
    startTime: str("startTime"),
    durationMin: Number(formData.get("durationMin")),
    expectedIntensity: str("expectedIntensity"),
    defaultRpe: Number(formData.get("defaultRpe")),
    validFrom: str("validFrom"),
    validUntil: str("validUntil"),
  });
  if (!parsed.success) return { error: t("calendar.errorInvalid") };
  const s = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("fixture_series").insert({
    user_id: user.id,
    kind: s.kind,
    weekdays: [...new Set(s.weekdays)].sort(),
    start_time: s.startTime,
    duration_min: s.durationMin,
    expected_intensity: s.expectedIntensity,
    default_rpe: s.defaultRpe,
    valid_from: s.validFrom,
    valid_until: s.validUntil,
  });
  if (error) {
    console.error("[calendar] Serie nicht gespeichert", error.message);
    return { error: t("calendar.errorSave") };
  }

  // Termine werden beim nächsten Laden angelegt; die Last von heute neu berechnen.
  const today = userToday(user.timezone);
  await recomputeDailyMetrics(user.id, today, today);
  revalidatePath("/calendar");
  revalidatePath("/week");
  return { ok: true };
}

/**
 * Beendet eine Serie: Künftige, noch geplante Termine werden entfernt. Vergangene Termine
 * und Termine mit Feedback bleiben (ohne Serienbezug) erhalten.
 */
export async function endSeries(seriesId: string) {
  const user = await getCurrentUser();
  const today = userToday(user.timezone);
  const supabase = await createClient();
  await supabase
    .from("sessions")
    .delete()
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .eq("status", "planned")
    .gte("date", today);
  await supabase.from("fixture_series").delete().eq("id", seriesId).eq("user_id", user.id);
  await recomputeDailyMetrics(user.id, today, today);
  revalidatePath("/calendar");
  revalidatePath("/week");
}
