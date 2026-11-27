import Link from "next/link";
import { mondayOf } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { DeltaTiles } from "@/features/overview/delta-tiles";
import { ReadinessRing } from "@/features/overview/readiness-ring";
import { LoadTrend, ReadinessTrend } from "@/features/overview/trend-charts";
import { WeekStrip } from "@/features/overview/week-strip";
import { ModeToggle } from "@/features/offseason/mode-toggle";
import { getOffseason } from "@/features/offseason/queries";
import { OffseasonStatus } from "@/features/offseason/status";
import { computeTodayWithTrend } from "@/features/today/metrics";
import { PainList } from "@/features/today/pain-list";
import { getWeek } from "@/features/week/queries";
import { formatLongDate, userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/** Home – „Wie geht es mir gerade?“ (docs/KONZEPT.md). */
export default async function HomePage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const { metrics, trend } = await computeTodayWithTrend(user.id, today, 28);
  const [week, off] = await Promise.all([
    getWeek(user.id, mondayOf(today), today, metrics),
    getOffseason(await createClient(), user.id, today),
  ]);
  const perf = metrics.performance;
  const scorePoints = trend.filter((p) => p.score != null).length;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{formatLongDate(today)}</p>
        <h1 className="text-4xl font-bold">{t("today.greeting", { name: user.name })}</h1>
      </div>

      <ModeToggle offseason={Boolean(off)} />
      {off && <OffseasonStatus off={off} date={today} t={t} editable />}

      <div className="card flex flex-col items-center gap-3">
        {perf ? (
          <Link href="/score" className="flex flex-col items-center gap-2" aria-label={t("home.tapForDetails")}>
            <ReadinessRing value={perf.score} light={metrics.light} label={t("home.scoreLabel")} emptyLabel="" />
            <p className="font-display text-2xl font-semibold">{t(`home.mood.${perf.mood}`)}</p>
            <span className="text-sm text-muted">{t("home.details")} →</span>
          </Link>
        ) : (
          <>
            <ReadinessRing value={null} light="grey" label={t("home.scoreLabel")} emptyLabel={t("home.noCheckin")} />
            <Link href="/checkin" className="btn-primary w-full text-center">
              {t("home.checkinCta")}
            </Link>
          </>
        )}
      </div>

      <DeltaTiles loadDelta={metrics.loadDelta} stressDelta={metrics.stressDelta} t={t} />

      <div className="flex flex-col gap-3">
        <h2 className="eyebrow">{t("home.weekTitle")}</h2>
        <WeekStrip week={week} today={today} t={t} />
      </div>

      <PainList spots={metrics.painSpots} t={t} />

      <div className="card flex flex-col gap-2">
        <h2 className="eyebrow">{t("home.trendScore")}</h2>
        {scorePoints >= 2 ? <ReadinessTrend data={trend} /> : <p className="text-sm text-muted">{t("overview.trendEmpty")}</p>}
      </div>
      <div className="card flex flex-col gap-2">
        <h2 className="eyebrow">{t("home.trendLoad")}</h2>
        <LoadTrend data={trend} />
      </div>
      <Link href="/history" className="btn-secondary text-center">
        {t("home.allTrends")}
      </Link>
    </section>
  );
}
