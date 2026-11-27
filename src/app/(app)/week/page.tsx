import type { Metadata } from "next";
import { mondayOf } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { computeMetricsFor } from "@/features/today/metrics";
import { getGoal } from "@/features/goals/queries";
import { replanWeek } from "@/features/plan/actions";
import { PlanAutoStart } from "@/features/plan/plan-auto-start";
import { autoStartStatus, getWeekPlan } from "@/features/plan/queries";
import { ReplanButton } from "@/features/plan/replan-button";
import { Info } from "@/features/ui/info";
import { getWeek } from "@/features/week/queries";
import { WeekView } from "@/features/week/week-view";
import { addDays, userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";

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
  const [week, { goal, frame }, plan] = await Promise.all([
    getWeek(user.id, monday, today, todayMetrics),
    getGoal(user.id),
    getWeekPlan(user.id, monday),
  ]);
  const extraPlanned = week.days
    .flatMap((d) => d.sessions)
    .filter((s) => !s.is_fixture && s.status !== "cancelled" && s.type !== "mobility" && s.type !== "recovery").length;
  const plannable = Boolean(goal) && addDays(monday, 6) >= today;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-4xl font-bold">{t("week.title")}</h1>
      {frame && frame.extraSessionsPerWeek > 0 && (
        <p className={`text-sm ${extraPlanned >= frame.extraSessionsPerWeek ? "text-muted" : "text-foreground"}`}>
          {t("goal.planCounter", { planned: extraPlanned, target: frame.extraSessionsPerWeek })}
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
