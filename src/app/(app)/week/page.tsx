import type { Metadata } from "next";
import { mondayOf } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { computeMetricsFor } from "@/features/today/metrics";
import { getGoal } from "@/features/goals/queries";
import { getWeek } from "@/features/week/queries";
import { WeekView } from "@/features/week/week-view";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Woche" };

export default async function WeekPage({ searchParams }: PageProps<"/week">) {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const { start } = await searchParams;
  const anchor = typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : today;
  const monday = mondayOf(anchor);

  const isThisWeek = monday === mondayOf(today);
  const todayMetrics = isThisWeek ? await computeMetricsFor(user.id, today, today) : null;
  const [week, { frame }] = await Promise.all([getWeek(user.id, monday, today, todayMetrics), getGoal(user.id)]);
  const extraPlanned = week.days
    .flatMap((d) => d.sessions)
    .filter((s) => !s.is_fixture && s.status !== "cancelled").length;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-4xl font-bold">{t("week.title")}</h1>
      {frame && frame.extraSessionsPerWeek > 0 && (
        <p className={`text-sm ${extraPlanned >= frame.extraSessionsPerWeek ? "text-muted" : "text-foreground"}`}>
          {t("goal.planCounter", { planned: extraPlanned, target: frame.extraSessionsPerWeek })}
        </p>
      )}
      <WeekView week={week} today={today} t={t} />
    </section>
  );
}
