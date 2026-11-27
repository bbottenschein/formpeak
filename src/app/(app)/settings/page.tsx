import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/features/auth/actions";
import { getCurrentUser } from "@/features/auth/session";
import { PushToggle } from "@/features/notifications/push-toggle";
import { DeleteAccountForm } from "@/features/privacy/delete-account-form";
import { SettingsForm } from "@/features/settings/settings-form";
import { vapidConfig } from "@/lib/env.server";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profil" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("profiles")
    .select("display_name, timezone, morning_reminder, evening_reminder, push_morning, push_evening, push_feedback")
    .eq("id", user.id)
    .single();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold">{t("profile.title")}</h1>
      </div>
      <Link href="/goals" className="card flex items-center justify-between gap-3">
        <span>
          <span className="block font-display text-lg font-semibold uppercase tracking-wide">{t("profile.goal")}</span>
          <span className="text-sm text-muted">{t("profile.goalHint")}</span>
        </span>
        <span aria-hidden className="text-muted">→</span>
      </Link>
      <Link href="/calendar" className="card flex items-center justify-between gap-3">
        <span>
          <span className="block font-display text-lg font-semibold uppercase tracking-wide">{t("profile.fixtures")}</span>
          <span className="text-sm text-muted">{t("profile.fixturesHint")}</span>
        </span>
        <span aria-hidden className="text-muted">→</span>
      </Link>
      <p className="text-sm text-muted">{t("settings.notificationsIntro")}</p>
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
            pushFeedback: p.push_feedback,
          }}
        />
      )}
      {user.role === "admin" && (
        <Link href="/admin" className="btn-secondary text-center">
          {t("profile.admin")}
        </Link>
      )}
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <h2 className="eyebrow">{t("privacy.title")}</h2>
        <p className="text-sm text-muted">{t("privacy.intro")}</p>
        <a href="/api/export" className="btn-secondary text-center">
          {t("privacy.export")}
        </a>
        <DeleteAccountForm />
      </div>
      <form action={logout}>
        <button className="btn-secondary w-full">{t("profile.logout")}</button>
      </form>
      <Link href="/sources" className="btn-secondary text-center">
        {t("sources.title")}
      </Link>
      <div className="flex flex-col gap-1 border-t border-line pt-4">
        <h2 className="eyebrow">{t("settings.install")}</h2>
        <p className="text-sm text-muted">{t("settings.installHint")}</p>
      </div>
    </section>
  );
}
