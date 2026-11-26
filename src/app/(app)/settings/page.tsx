import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { PushToggle } from "@/features/notifications/push-toggle";
import { SettingsForm } from "@/features/settings/settings-form";
import { vapidConfig } from "@/lib/env.server";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("profiles")
    .select("display_name, timezone, morning_reminder, evening_reminder, push_morning, push_evening")
    .eq("id", user.id)
    .single();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("settings.notificationsIntro")}</p>
      </div>
      <PushToggle publicKey={vapidConfig()?.publicKey ?? null} />
      {p && (
        <SettingsForm
          initial={{
            displayName: p.display_name,
            timezone: p.timezone,
            morningReminder: p.morning_reminder,
            eveningReminder: p.evening_reminder,
            pushMorning: p.push_morning,
            pushEvening: p.push_evening,
          }}
        />
      )}
      <div className="flex flex-col gap-1 border-t border-line pt-4">
        <h2 className="eyebrow">{t("settings.install")}</h2>
        <p className="text-sm text-muted">{t("settings.installHint")}</p>
      </div>
    </section>
  );
}
