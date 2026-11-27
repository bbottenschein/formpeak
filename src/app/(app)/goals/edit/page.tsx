import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { GoalForm } from "@/features/goals/goal-form";
import { getGoal } from "@/features/goals/queries";
import { emptyGoal } from "@/features/goals/schema";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Ziel ändern" };

export default async function GoalEditPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const { goal, frame } = await getGoal(user.id);
  return (
    <section className="flex flex-col gap-6">
      <p className="eyebrow">{t("goal.title")}</p>
      <GoalForm initial={goal ?? emptyGoal(frame)} />
    </section>
  );
}
