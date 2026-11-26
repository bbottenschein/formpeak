import Link from "next/link";
import { mondayOf } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { getCheckinStatus } from "@/features/checkin/queries";
import { OverviewHero } from "@/features/overview/overview-hero";
import { LoadTrend, ReadinessTrend } from "@/features/overview/trend-charts";
import { WeekStrip } from "@/features/overview/week-strip";
import { SessionCard } from "@/features/sessions/session-card";
import { computeTodayWithTrend } from "@/features/today/metrics";
import { PainList } from "@/features/today/pain-list";
import { getWeek } from "@/features/week/queries";
import { formatLongDate, userToday, zonedParts } from "@/lib/date";
import { getT } from "@/lib/i18n/server";

/** Übersicht: Readiness, Woche mit festen Terminen, heutige Einheiten und Verlauf. */
export default async function OverviewPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const { metrics, trend } = await computeTodayWithTrend(user.id, today, 14);
  const [week, status] = await Promise.all([
    getWeek(user.id, mondayOf(today), today, metrics),
    getCheckinStatus(user.id, today),
  ]);
  const todaySessions = week.days.find((d) => d.date === today)?.sessions ?? [];
  const readinessPoints = trend.filter((p) => p.readiness != null).length;
  const evening = zonedParts(new Date(), user.timezone).hour >= 17;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{formatLongDate(today)}</p>
        <h1 className="text-4xl font-bold">{t("today.greeting", { name: user.name })}</h1>
      </div>

      <OverviewHero metrics={metrics} t={t} />

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow">{t("overview.weekTitle")}</h2>
          <Link href="/week" className="text-sm text-muted underline underline-offset-4">
            {t("overview.weekLink")}
          </Link>
        </div>
        <WeekStrip week={week} today={today} t={t} />
        {todaySessions.length > 0 && (
          <div className="flex flex-col gap-2">
            {todaySessions.map((s) => (
              <SessionCard key={s.id} session={s} hints={s.hints} feedbackDue={s.feedbackDue} t={t} />
            ))}
          </div>
        )}
      </div>

      <PainList spots={metrics.painSpots} t={t} />

      <div className="card flex flex-col gap-2">
        <h2 className="eyebrow">{t("overview.trendReadiness")}</h2>
        {readinessPoints >= 2 ? <ReadinessTrend data={trend} /> : <p className="text-sm text-muted">{t("overview.trendEmpty")}</p>}
      </div>
      <div className="card flex flex-col gap-2">
        <h2 className="eyebrow">{t("overview.trendLoad")}</h2>
        <LoadTrend data={trend} />
      </div>

      {status.evening ? (
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
      )}
    </section>
  );
}
