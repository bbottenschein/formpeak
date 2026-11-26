import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { SessionCard } from "@/features/sessions/session-card";
import { getWeek } from "@/features/week/queries";
import { mondayOf } from "@/core/load";
import { LightCard } from "@/features/today/light-card";
import { computeMetricsFor } from "@/features/today/metrics";
import { PainList } from "@/features/today/pain-list";
import { formatLongDate, userToday, zonedParts } from "@/lib/date";
import { getCheckinStatus } from "@/features/checkin/queries";
import { getT } from "@/lib/i18n/server";

export default async function TodayPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  // Immer frisch berechnen: Die Ampel hängt vom heutigen Datum und allen Daten bis heute ab.
  const metrics = await computeMetricsFor(user.id, today, today);
  const hasCheckin = metrics.readiness != null;
  const week = await getWeek(user.id, mondayOf(today), today, metrics);
  const todaySessions = week.days.find((d) => d.date === today)?.sessions ?? [];
  const status = await getCheckinStatus(user.id, today);
  const evening = zonedParts(new Date(), user.timezone).hour >= 17;
  const eveningBlock = status.evening ? (
    <Link href="/checkin/evening" className="text-center text-sm text-muted underline underline-offset-4">
      {t("today.eveningDone")}
    </Link>
  ) : evening ? (
    <div className="card flex flex-col gap-3">
      <p className="text-muted">{t("today.eveningPrompt")}</p>
      <Link href="/checkin/evening" className="btn-primary text-center">
        {t("today.eveningCta")}
      </Link>
    </div>
  ) : (
    <Link href="/checkin/evening" className="text-center text-sm text-muted underline underline-offset-4">
      {t("today.eveningCta")}
    </Link>
  );
  const sessionsBlock = (
    <div className="flex flex-col gap-2">
      <h2 className="eyebrow">{t("today.sessionsTitle")}</h2>
      {todaySessions.length === 0 && <p className="text-sm text-muted">{t("today.noSessions")}</p>}
      {todaySessions.map((s) => (
        <SessionCard key={s.id} session={s} hints={s.hints} feedbackDue={s.feedbackDue} t={t} />
      ))}
    </div>
  );

  return (
    <section className="flex flex-col gap-5">
      <div>
        <p className="eyebrow">{formatLongDate(today)}</p>
        <h1 className="text-4xl font-bold">{t("today.greeting", { name: user.name })}</h1>
      </div>

      {hasCheckin ? (
        <>
          <LightCard metrics={metrics} t={t} />
          {sessionsBlock}
          <PainList spots={metrics.painSpots} t={t} />
          <Link href="/checkin" className="btn-secondary text-center">
            {t("today.checkinEdit")}
          </Link>
        </>
      ) : (
        <div className="card flex flex-col gap-4">
          <p className="text-muted">{t("today.noCheckin")}</p>
          <PainList spots={metrics.painSpots} t={t} />
          <Link href="/checkin" className="btn-primary text-center">
            {t("today.checkinCta")}
          </Link>
        </div>
      )}
      {!hasCheckin && sessionsBlock}
      {eveningBlock}
    </section>
  );
}
