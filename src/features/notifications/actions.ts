"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/features/auth/session";
import { isValidTimeZone } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { sendPush } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

type SubscriptionJson = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Speichert das Push-Abo dieses Geräts (ein Eintrag pro Gerät). */
export async function savePushSubscription(sub: SubscriptionJson): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const endpoint = sub.endpoint ?? "";
  const p256dh = sub.keys?.p256dh ?? "";
  const auth = sub.keys?.auth ?? "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth || endpoint.length > 1000) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint, p256dh, auth }, { onConflict: "endpoint" });
  if (error) console.error("[push] Abo nicht gespeichert", error.message);
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
}

export async function sendTestPush(): Promise<{ sent: number }> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const sent = await sendPush([user.id], { title: t("push.testTitle"), body: t("push.testBody"), url: "/", tag: "test" });
  return { sent };
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  timezone: z.string().refine(isValidTimeZone),
  morningReminder: time,
  eveningReminder: time,
  pushMorning: z.boolean(),
  pushEvening: z.boolean(),
  pushFeedback: z.boolean(),
});

export type SettingsState = { error?: string; ok?: boolean };

/** Profil und Erinnerungszeiten speichern. */
export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const parsed = settingsSchema.safeParse({
    displayName: formData.get("displayName"),
    timezone: formData.get("timezone"),
    morningReminder: formData.get("morningReminder"),
    eveningReminder: formData.get("eveningReminder"),
    pushMorning: formData.get("pushMorning") === "on",
    pushEvening: formData.get("pushEvening") === "on",
    pushFeedback: formData.get("pushFeedback") === "on",
  });
  if (!parsed.success) return { error: t("settings.errorSave") };
  const s = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: s.displayName,
      timezone: s.timezone,
      morning_reminder: s.morningReminder,
      evening_reminder: s.eveningReminder,
      push_morning: s.pushMorning,
      push_evening: s.pushEvening,
      push_feedback: s.pushFeedback,
    })
    .eq("id", user.id);
  if (error) {
    console.error("[settings] nicht gespeichert", error.message);
    return { error: t("settings.errorSave") };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
