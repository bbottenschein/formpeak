"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type BodyState = { error?: string; ok?: boolean };

const parse = (raw: FormDataEntryValue | null) => {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Math.round(Number(s) * 10) / 10;
  return Number.isFinite(n) ? n : NaN;
};

/** Körpergewicht und/oder Taillenumfang für heute speichern (überschreibt den heutigen Eintrag). */
export async function saveBodyMeasurement(_prev: BodyState, formData: FormData): Promise<BodyState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const weight = parse(formData.get("weight"));
  const waist = parse(formData.get("waist"));
  const valid = (v: number | null, min: number, max: number) => v == null || (!Number.isNaN(v) && v >= min && v <= max);
  if ((weight == null && waist == null) || !valid(weight, 30, 250) || !valid(waist, 40, 200)) {
    return { error: t("log.bodyInvalid") };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("body_measurements")
    .upsert({ user_id: user.id, date: userToday(user.timezone), weight_kg: weight, waist_cm: waist }, { onConflict: "user_id,date" });
  if (error) {
    console.error("[log] Körpermaße nicht gespeichert", error.message);
    return { error: t("log.bodyInvalid") };
  }
  revalidatePath("/log");
  return { ok: true };
}

/** Neue Gym-Einheit für heute anlegen und direkt ins Gym-Log springen. */
export async function startGymSession() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      date: userToday(user.timezone),
      type: "gym",
      status: "planned",
      is_fixture: false,
      duration_min: 60,
      default_rpe: 6,
      gym_focus: "full",
      planned_by: "user",
    })
    .select("id")
    .single();
  redirect(data ? `/sessions/${data.id}` : "/log");
}
