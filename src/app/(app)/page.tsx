import Link from "next/link";
import { addDays, mondayOf, weekdayOf } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { DeltaTiles } from "@/features/overview/delta-tiles";
import { ReadinessRing } from "@/features/overview/readiness-ring";
import { LoadTrend, ReadinessTrend } from "@/features/overview/trend-charts";
import { WeekStrip } from "@/features/overview/week-strip";
import { getConsistency, getReviewData, previousMonthStart } from "@/features/review/queries";
import { ReviewCard } from "@/features/review/review-card";
import { computeTodayWithTrend } from "@/features/today/metrics";
import { Info } from "@/features/ui/info";
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
  const supabase = await createClient();
  // Rückblick: sonntags die laufende Woche, montags die Vorwoche, am 1.–3. der Vormonat.
  const weekday = weekdayOf(today);
  const reviewWeek = weekday === 0 ? mondayOf(today) : weekday === 1 ? addDays(mondayOf(today), -7) : null;
  const reviewMonth = Number(today.slice(8, 10)) <= 3 ? previousMonthStart(today) : null;
  const [week, consistency, weekReview, monthReview, { data: texts }] = await Promise.all([
    getWeek(user.id, mondayOf(today), today, metrics),
    getConsistency(supabase, user.id, today),
    reviewWeek ? getReviewData(supabase, user.id, "week", reviewWeek, today) : Promise.resolve(null),
    reviewMonth ? getReviewData(supabase, user.id, "month", reviewMonth, today) : Promise.resolve(null),
    supabase.from("reviews").select("kind, period_start, text").eq("user_id", user.id).in("period_start", [reviewWeek, reviewMonth].filter((x): x is string => Boolean(x))),
  ]);
  const cachedText = (kind: string, from: string | null) => (texts ?? []).find((r) => r.kind === kind && r.period_start === from)?.text ?? null;
  const perf = metrics.performance;
  // Nach dem Check-in: Hinweis, wenn die App den heutigen Plan angepasst hat (tägliche Anpassung).
  const adjusted = (week.days.find((d) => d.date === today)?.sessions ?? []).find(
    (s) => (s.planned_by === "ai" || s.planned_by === "rules") && s.adjusted_on === today && s.adjustment,
  );
  const scorePoints = trend.filter((p) => p.score != null).length;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{formatLongDate(today)}</p>
        <h1 className="text-4xl font-bold">{t("today.greeting", { name: user.name })}</h1>
      </div>

      {adjusted?.adjustment && (
        <Link href="/today" className="card flex items-center justify-between gap-3 border-primary/60">
          <span className="text-sm">{t(`home.adjusted.${adjusted.adjustment}`)}</span>
          <span className="shrink-0 font-display text-sm font-semibold uppercase tracking-wide">{t("home.adjustedCta")} →</span>
        </Link>
      )}


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

      {(consistency.streak > 0 || consistency.rate != null) && (
        <div className="flex items-center justify-between gap-2 border-y border-line py-2.5 text-sm">
          <span>
            {[
              consistency.streak > 0 ? t("home.streak", { days: consistency.streak }) : null,
              consistency.rate != null ? t("home.rate", { value: consistency.rate }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <Info title={t("home.consistencyTitle")}>
            <p>{t("home.consistencyInfo")}</p>
          </Info>
        </div>
      )}

      {weekReview && <ReviewCard data={weekReview} text={cachedText("week", reviewWeek)} t={t} />}
      {monthReview && <ReviewCard data={monthReview} text={cachedText("month", reviewMonth)} t={t} />}

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
