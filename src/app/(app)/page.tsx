import Link from "next/link";
import { mondayOf } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { getCheckinStatus } from "@/features/checkin/queries";
import { GoalCard } from "@/features/goals/goal-card";
import { getGoal } from "@/features/goals/queries";
import { OverviewHero } from "@/features/overview/overview-hero";
import { QuickFeedback } from "@/features/overview/quick-feedback";
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
  const [week, status, { goal }] = await Promise.all([
    getWeek(user.id, mondayOf(today), today, metrics),
    getCheckinStatus(user.id, today),
    getGoal(user.id),
  ]);
  const todaySessions = week.days.find((d) => d.date === today)?.sessions ?? [];
  // Offenes Feedback dieser Woche, sobald die Einheit vorbei sein dürfte (heute ab Startzeit).
  const nowTime = zonedParts(new Date(), user.timezone).time;
  const openFeedback = week.days
    .flatMap((d) => d.sessions)
    .filter((s) => s.feedbackDue && (s.date < today || !s.start_time || s.start_time.slice(0, 5) <= nowTime));
  const openIds = new Set(openFeedback.map((s) => s.id));
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
        {todaySessions.some((s) => !openIds.has(s.id)) && (
          <div className="flex flex-col gap-2">
            {todaySessions.filter((s) => !openIds.has(s.id)).map((s) => (
              <SessionCard key={s.id} session={s} hints={s.hints} feedbackDue={s.feedbackDue} t={t} />
            ))}
          </div>
        )}
      </div>

      {openFeedback.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="eyebrow">{t("overview.feedbackTitle")}</h2>
          <p className="text-xs text-muted">{t("overview.feedbackHint")}</p>
          {openFeedback.map((s) => (
            <QuickFeedback
              key={s.id}
              sessionId={s.id}
              title={t(`sessionTypes.${s.type}`)}
              meta={[formatLongDate(s.date), s.start_time?.slice(0, 5), t("common.minutes", { value: s.duration_min })]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </div>
      )}

      <PainList spots={metrics.painSpots} t={t} />

      <GoalCard goal={goal} t={t} />

      <div className="card flex flex-col gap-2">
        <h2 className="eyebrow">{t("overview.trendReadiness")}</h2>
        {readinessPoints >= 2 ? <ReadinessTrend data={trend} /> : <p className="text-sm text-muted">{t("overview.trendEmpty")}</p>}
      </div>
      <div className="card flex flex-col gap-2">
        <h2 className="eyebrow">{t("overview.trendLoad")}</h2>
        <LoadTrend data={trend} />
      </div>
      <Link href="/history" className="btn-secondary text-center">
        {t("history.link")}
      </Link>

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
