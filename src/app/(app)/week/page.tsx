import type { Metadata } from "next";
import { mondayOf } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { computeMetricsFor } from "@/features/today/metrics";
import { getGoal } from "@/features/goals/queries";
import { getOffseason } from "@/features/offseason/queries";
import { OffseasonStatus } from "@/features/offseason/status";
import { replanWeek } from "@/features/plan/actions";
import { PlanAutoStart } from "@/features/plan/plan-auto-start";
import { autoStartStatus, getWeekPlan } from "@/features/plan/queries";
import { ReplanButton } from "@/features/plan/replan-button";
import { Info } from "@/features/ui/info";
import { getWeek } from "@/features/week/queries";
import { WeekView } from "@/features/week/week-view";
import { addDays, userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Woche" };
// Server Actions dieser Seite (Wochenplan mit KI) dürfen länger laufen.
export const maxDuration = 300;

export default async function WeekPage({ searchParams }: PageProps<"/week">) {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const { start } = await searchParams;
  const anchor = typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : today;
  const monday = mondayOf(anchor);

  const isThisWeek = monday === mondayOf(today);
  const todayMetrics = isThisWeek ? await computeMetricsFor(user.id, today, today) : null;
  const firstDay = monday > today ? monday : today;
  const [week, { goal, frame: seasonFrame }, plan, off] = await Promise.all([
    getWeek(user.id, monday, today, todayMetrics),
    getGoal(user.id),
    getWeekPlan(user.id, monday),
    createClient().then((sb) => getOffseason(sb, user.id, firstDay > addDays(monday, 6) ? monday : firstDay)),
  ]);
  const frame = off?.frame ?? seasonFrame;
  const extraPlanned = week.days
    .flatMap((d) => d.sessions)
    .filter((s) => !s.is_fixture && s.status !== "cancelled" && s.type !== "mobility" && s.type !== "recovery").length;
  const plannable = Boolean(goal || off) && addDays(monday, 6) >= today;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-4xl font-bold">{t("week.title")}</h1>
      {off && <OffseasonStatus off={off} date={firstDay > addDays(monday, 6) ? monday : firstDay} t={t} />}
      {frame && frame.extraSessionsPerWeek > 0 && (
        <p className={`text-sm ${extraPlanned >= frame.extraSessionsPerWeek ? "text-muted" : "text-foreground"}`}>
          {t(off ? "offseason.unitCounter" : "goal.planCounter", { planned: extraPlanned, target: frame.extraSessionsPerWeek })}
        </p>
      )}
      {plannable &&
        (!plan || plan.status !== "ready" ? (
          <PlanAutoStart key={monday} weekStart={monday} status={autoStartStatus(plan)} />
        ) : (
          plan.focus && (
            <div className="flex items-start gap-2 border-l-2 border-primary pl-3">
              <p className="flex-1">{plan.focus}</p>
              <Info title={t("plan.focus")}>
                <p>{t(plan.source === "ai" ? "plan.byAiInfo" : "plan.byRulesInfo")}</p>
                {plan.adjusted && <p>{t("plan.adjusted")}</p>}
              </Info>
            </div>
          )
        ))}
      <WeekView week={week} today={today} t={t} />
      {plannable && plan?.status === "ready" && (
        <form action={replanWeek.bind(null, monday)} className="flex items-center gap-2">
          <ReplanButton />
          <Info title={t("plan.replan")}>
            <p>{t("plan.replanHint")}</p>
          </Info>
        </form>
      )}
    </section>
  );
}
