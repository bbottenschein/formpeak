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
    testName: null,
    baselineValue: null,
    targetValue: null,
    unit: null,
    targetDate: null,
    extraSessionsPerWeek: frame?.extraSessionsPerWeek ?? 2,
    timeBudgetMin: frame?.timeBudgetMin ?? 60,
    availableWeekdays: frame?.availableWeekdays ?? [1, 3, 5],
    equipment: frame?.equipment.length ? frame.equipment : ["gym", "outdoor"],
  };
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold">{t("goal.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("goal.intro")}</p>
      </div>
      <GoalForm initial={initial} />
    </section>
  );
}
