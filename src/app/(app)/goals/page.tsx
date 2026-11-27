import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { GoalForm } from "@/features/goals/goal-form";
import { GoalOverview } from "@/features/goals/goal-overview";
import { getGoal, getGoalWithTests } from "@/features/goals/queries";
import { emptyGoal } from "@/features/goals/schema";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Ziel" };

/** Ziel – „Komme ich voran?“. Ohne Ziel startet das Onboarding. */
export default async function GoalsPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const [{ goal, frame }, { tests }] = await Promise.all([getGoal(user.id), getGoalWithTests(user.id)]);

  if (!goal) {
    return (
      <section className="flex flex-col gap-6">
        <p className="eyebrow">{t("goal.title")}</p>
        <GoalForm initial={emptyGoal(frame)} />
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-4xl font-bold">{t("goalView.title")}</h1>
      <GoalOverview goal={goal} tests={tests} today={userToday(user.timezone)} t={t} />
    </section>
  );
}
