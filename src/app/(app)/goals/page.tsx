import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { GoalForm } from "@/features/goals/goal-form";
import { FrameCard } from "@/features/goals/frame-card";
import { GoalOverview } from "@/features/goals/goal-overview";
import { getGoal, getGoalWithTests } from "@/features/goals/queries";
import { emptyGoal } from "@/features/goals/schema";
import { ModeToggle } from "@/features/offseason/mode-toggle";
import { getOffseason } from "@/features/offseason/queries";
import { Info } from "@/features/ui/info";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ziel" };

/** Ziel – „Komme ich voran?“. Ohne Ziel startet das Onboarding. */
export default async function GoalsPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const supabase = await createClient();
  const [{ goal, frame }, { tests }, off] = await Promise.all([
    getGoal(user.id),
    getGoalWithTests(user.id),
    getOffseason(supabase, user.id, today),
  ]);

  // Modus (Saison / Off-Season) gehört zum Ziel: ein Ziel, der Rahmen wechselt mit dem Modus.
  const mode = (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <ModeToggle offseason={Boolean(off)} />
      </div>
      <Info title={t("offseason.toggleLabel")}>
        <p>{t("goalView.modeInfo")}</p>
      </Info>
    </div>
  );

  if (!goal) {
    return (
      <section className="flex flex-col gap-6">
        {mode}
        <p className="eyebrow">{t("goal.title")}</p>
        <GoalForm initial={emptyGoal(frame)} />
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-4xl font-bold">{t("goalView.title")}</h1>
      {mode}
      <GoalOverview goal={goal} tests={tests} today={today} frameCard={<FrameCard frame={frame} off={off} today={today} t={t} />} t={t} />
    </section>
  );
}
