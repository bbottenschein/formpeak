import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { GoalForm } from "@/features/goals/goal-form";
import { getGoal } from "@/features/goals/queries";
import type { GoalInput } from "@/features/goals/schema";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Ziel" };

export default async function GoalsPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const { goal, frame } = await getGoal(user.id);
  const initial: GoalInput = goal ?? {
    type: "endurance",
    description: "",
    testKey: null,
    testName: null,
    aiSummary: null,
    baselineValue: null,
    targetValue: null,
    unit: null,
    targetDate: null,
    extraSessionsPerWeek: frame?.extraSessionsPerWeek ?? 2,
    timeBudgetMin: frame?.timeBudgetMin ?? 60,
    availableWeekdays:
      frame && frame.availableWeekdays.length === frame.extraSessionsPerWeek ? frame.availableWeekdays : [],
    equipment: frame?.equipment ?? [],
  };
  return (
    <section className="flex flex-col gap-6">
      <p className="eyebrow">{t("goal.title")}</p>
      <GoalForm initial={initial} />
    </section>
  );
}
