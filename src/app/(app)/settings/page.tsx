import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/features/auth/actions";
import { getCurrentUser } from "@/features/auth/session";
import { PushToggle } from "@/features/notifications/push-toggle";
import { DeleteAccountForm } from "@/features/privacy/delete-account-form";
import { SettingsForm } from "@/features/settings/settings-form";
import { Info } from "@/features/ui/info";
import { vapidConfig } from "@/lib/env.server";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profil" };

const rowClass = "flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-surface-raised";

function Row({ href, label, external = false }: { href: string; label: string; external?: boolean }) {
  const content = (
    <>
      <span>{label}</span>
      <span aria-hidden className="text-muted">→</span>
    </>
  );
  return external ? (
    <a href={href} className={rowClass}>
      {content}
    </a>
  ) : (
    <Link href={href} className={rowClass}>
      {content}
    </Link>
  );
}

/** Profil: gruppierte Listen statt Textblöcke, Erklärungen hinter Info-Symbolen. */
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
    <section className="flex flex-col gap-7">
      <h1 className="text-4xl font-bold">{t("profile.title")}</h1>

      <nav className="card flex flex-col divide-y divide-line overflow-hidden p-0">
        <Row href="/goals" label={t("profile.goal")} />
        <Row href="/calendar" label={t("profile.fixtures")} />
      </nav>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">{t("settings.notifications")}</h2>
          <Info title={t("settings.notifications")}>
            <p>{t("settings.notificationsIntro")}</p>
          </Info>
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
              pushFeedback: p.push_feedback,
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">{t("privacy.title")}</h2>
          <Info title={t("privacy.title")}>
            <p>{t("privacy.intro")}</p>
          </Info>
        </div>
        <div className="card flex flex-col divide-y divide-line overflow-hidden p-0">
          <Row href="/api/export" label={t("privacy.export")} external />
          <DeleteAccountForm />
        </div>
      </div>

      <div className="card flex flex-col divide-y divide-line overflow-hidden p-0">
        <Row href="/sources" label={t("sources.title")} />
        <div className={rowClass}>
          <span>{t("settings.install")}</span>
          <Info title={t("settings.install")}>
            <p>{t("settings.installHint")}</p>
          </Info>
        </div>
        {user.role === "admin" && <Row href="/admin" label={t("profile.admin")} />}
      </div>

      <form action={logout}>
        <button className="btn-secondary w-full">{t("profile.logout")}</button>
      </form>
    </section>
  );
}
