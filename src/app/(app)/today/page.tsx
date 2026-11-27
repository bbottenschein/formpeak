import type { Metadata } from "next";
import Link from "next/link";
import { matchdayContext, mondayOf, offseasonWeek } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { getCheckinStatus } from "@/features/checkin/queries";
import { getGoal, getGoalWithTests } from "@/features/goals/queries";
import { testSchedule } from "@/features/goals/progress";
import { getOffseason } from "@/features/offseason/queries";
import { QuickFeedback } from "@/features/overview/quick-feedback";
import { PlanAutoStart } from "@/features/plan/plan-auto-start";
import { PlannedSessionCard } from "@/features/plan/planned-session";
import { Info } from "@/features/ui/info";
import { autoStartStatus, getPlannedExercises, getWeekPlan } from "@/features/plan/queries";
import { SessionCard, hintText } from "@/features/sessions/session-card";
import { computeMetricsFor } from "@/features/today/metrics";
import { suggestRoutine } from "@/features/today/routines";
import { pickTip, type Tip } from "@/features/today/tip";
import { getWeek } from "@/features/week/queries";
import { formatLongDate, userToday, zonedParts } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { Translate } from "@/lib/i18n/translate";

export const metadata: Metadata = { title: "Heute" };
// Server Actions dieser Seite (Wochenplan mit KI) dürfen länger laufen.
export const maxDuration = 300;

function tipText(tip: Tip, t: Translate): string {
  switch (tip.code) {
    case "feedback_open":
      return t("today2.tips.feedback_open", { count: tip.count });
    case "stress_high":
    case "load_high":
      return t(`today2.tips.${tip.code}`, { percent: tip.percent });
    case "week_hint":
      return tip.hint.code === "weekly_load_increase"
        ? t("week.hints.weekly_load_increase", { percent: tip.hint.percent })
        : t("week.hints.no_rest_day");
    default:
      return t(`today2.tips.${tip.code}`);
  }
}

/** Heute – „Was mache ich heute?“ (docs/KONZEPT.md). */
export default async function TodayPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const metrics = await computeMetricsFor(user.id, today, today);
  const monday = mondayOf(today);
  const [week, status, { goal, frame }, { tests }, plan, off] = await Promise.all([
    getWeek(user.id, monday, today, metrics),
    getCheckinStatus(user.id, today),
    getGoal(user.id),
    getGoalWithTests(user.id),
    getWeekPlan(user.id, monday),
    createClient().then((sb) => getOffseason(sb, user.id, today)),
  ]);
  // Wochenplan gibt es mit Ziel – in der Off-Season auch ohne.
  const planned = Boolean(goal || off);

  const isPlan = (s: { planned_by: string }) => s.planned_by === "ai" || s.planned_by === "rules";
  const dayRows = week.days.find((d) => d.date === today)?.sessions ?? [];
  // Nach dem Check-in gestrichene Vorschläge (tägliche Anpassung).
  const removedToday = dayRows.filter((s) => s.status === "cancelled" && isPlan(s) && s.adjusted_on === today);
  const dayAll = dayRows
    .filter((s) => s.status !== "cancelled")
    .sort((a, b) => (a.start_time ?? "99").localeCompare(b.start_time ?? "99"));
  // Vorschläge aus dem Wochenplan stehen in eigenen Karten mit Übungen.
  const planToday = planned ? dayAll.filter(isPlan) : [];
  const todaySessions = dayAll.filter((s) => !planToday.includes(s));
  const exercises = await getPlannedExercises(planToday.map((s) => s.id));
  const nowTime = zonedParts(new Date(), user.timezone).time;
  const openFeedback = week.days
    .flatMap((d) => d.sessions)
    .filter((s) => s.feedbackDue && (s.date < today || !s.start_time || s.start_time.slice(0, 5) <= nowTime))
    .filter((s) => !planToday.includes(s));
  // Unter „Dein Tag“ nur heutiges Feedback; ältere offene Einheiten nennt der Tipp (→ Erfassen).
  const openToday = openFeedback.filter((s) => s.date === today);
  const openIds = new Set(openToday.map((s) => s.id));
  const matchDates = week.days.flatMap((d) => d.sessions).filter((s) => s.type === "match" && s.status !== "cancelled").map((s) => s.date);
  const routine = suggestRoutine({
    goalType: goal?.type ?? null,
    light: metrics.light,
    md: matchdayContext(today, matchDates),
    hasFixtureToday: todaySessions.some((s) => s.is_fixture),
    equipment: frame?.equipment ?? [],
  });
  const tip = pickTip({
    metrics,
    openFeedback: openFeedback.length,
    weekHints: week.hints,
    testDueInDays: testSchedule(tests, today).daysUntil,
    restPhase: off ? offseasonWeek(off.phase, today).block === "recover" : false,
  });
  const evening = zonedParts(new Date(), user.timezone).hour >= 17;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{formatLongDate(today)}</p>
        <h1 className="text-4xl font-bold">{t("today2.title")}</h1>
      </div>

      {!status.morning && (
        <Link href="/checkin" className="btn-primary text-center">
          {t("home.checkinCta")}
        </Link>
      )}

      {todaySessions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="eyebrow">{t("today2.schedule")}</h2>
          {todaySessions
            .filter((s) => !openIds.has(s.id))
            .map((s) => (
              <SessionCard key={s.id} session={s} hints={s.hints} feedbackDue={s.feedbackDue} t={t} />
            ))}
          {openToday.map((s) => (
            <QuickFeedback
              key={s.id}
              sessionId={s.id}
              title={t(`sessionTypes.${s.type}`)}
              meta={[s.start_time?.slice(0, 5), t("common.minutes", { value: s.duration_min })].filter(Boolean).join(" · ")}
            />
          ))}
        </div>
      )}

      {planned && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">{t("plan.today")}</h2>
            {plan?.status === "ready" && (
              <Link href="/week" className="text-sm text-muted hover:text-foreground">
                {t("plan.week")} →
              </Link>
            )}
          </div>
          {!plan || plan.status !== "ready" ? (
            <PlanAutoStart weekStart={monday} status={autoStartStatus(plan)} />
          ) : planToday.length > 0 ? (
            planToday.map((s) => <PlannedSessionCard key={s.id} session={s} exercises={exercises[s.id] ?? []} today={today} t={t} />)
          ) : (
            <p className="text-sm text-muted">{t("plan.todayNone")}</p>
          )}
          {removedToday.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 text-sm text-muted">
              <span className="line-through">{s.title ?? t(`sessionTypes.${s.type}`)}</span>
              <Info title={t("plan.adjust.removed")}>
                <p>{t(`plan.adjust.why.${s.adjustment ?? "rules"}`)}</p>
              </Info>
            </div>
          ))}
        </div>
      )}

      {!planned && routine && (
        <div className="flex flex-col gap-2">
          <h2 className="eyebrow">{t("today2.suggestionNoGoal")}</h2>
          <div className="card flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <p className="font-display text-2xl font-semibold leading-tight">{t(`routines.titles.${routine.key}`)}</p>
                <p className="text-sm text-muted">{t("today2.minutes", { value: routine.minutes })}</p>
              </div>
              <Info title={t(`routines.titles.${routine.key}`)}>
                <p>{t(`today2.routineWhy.${routine.key}`)}</p>
              </Info>
            </div>
            <Link href={`/today/routine/${routine.key}`} className="btn-primary text-center">
              {t("training.start")}
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/goals" className="text-sm underline underline-offset-4">
              {t("plan.goalCta")}
            </Link>
            <Info title={t("plan.goalCta")}>
              <p>{t("plan.noGoal")}</p>
            </Info>
          </div>
        </div>
      )}

      {(tip || todaySessions.some((s) => s.hints.length > 0)) && (
        <div className="flex flex-col gap-2 border-l-2 border-line pl-3">
          <h2 className="eyebrow">{t("today2.tip")}</h2>
          {tip && <p className="text-sm">{tipText(tip, t)}</p>}
          {tip?.code === "feedback_open" && (
            <Link href="/log" className="self-start text-sm underline underline-offset-4">
              {t("today2.toLog")}
            </Link>
          )}
          {todaySessions.flatMap((s) => s.hints).length > 0 && (
            <p className="text-xs text-muted">{hintText(todaySessions.flatMap((s) => s.hints)[0], t)}</p>
          )}
        </div>
      )}

      {evening && !status.evening && (
        <Link href="/checkin/evening" className="btn-secondary text-center">
          {t("today2.eveningCta")}
        </Link>
      )}
    </section>
  );
}
