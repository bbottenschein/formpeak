import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { FrameCard } from "@/features/goals/frame-card";
import { GoalEditor } from "@/features/goals/goal-editor";
import { GoalForm } from "@/features/goals/goal-form";
import { GoalArchive, GoalPeriod, ProgressCard } from "@/features/goals/goal-sections";
import { archiveIfEnded, getArchive } from "@/features/goals/lifecycle";
import { getGoal, getGoalWithTests } from "@/features/goals/queries";
import { emptyGoal } from "@/features/goals/schema";
import { ModeToggle } from "@/features/offseason/mode-toggle";
import { getOffseason } from "@/features/offseason/queries";
import { Info } from "@/features/ui/info";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ziel" };

/**
 * Ziel – „Komme ich voran?“: Zeitraum oben, dann Ziel → Trainingsvolumen → Progress,
 * unten das Archiv früherer Ziele. Nach dem Zieldatum wird automatisch archiviert.
 */
export default async function GoalsPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const supabase = await createClient();
  await archiveIfEnded(supabase, user.id, today);
  const [{ goal, frame }, { tests }, off, archive, { data: meta }] = await Promise.all([
    getGoal(user.id),
    getGoalWithTests(user.id),
    getOffseason(supabase, user.id, today),
    getArchive(supabase, user.id),
    supabase.from("goals").select("starts_on, created_at").eq("user_id", user.id).eq("active", true).maybeSingle(),
  ]);

  if (!goal) {
    return (
      <section className="flex flex-col gap-6">
        <p className="eyebrow">{archive.length ? t("goalView.newGoal") : t("goal.title")}</p>
        <GoalForm initial={emptyGoal(frame)} />
        <GoalArchive goals={archive} t={t} />
      </section>
    );
  }

  const startsOn = meta?.starts_on ?? (meta?.created_at as string | undefined)?.slice(0, 10) ?? today;
  return (
    <section className="flex flex-col gap-7">
      <div>
        <GoalPeriod startsOn={startsOn} targetDate={goal.targetDate} today={today} t={t} />
        <h1 className="text-4xl font-bold">{t("goalView.title")}</h1>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">{t("goalView.sectionGoal")}</h2>
          {goal.aiSummary && (
            <Info title={t("goalView.inYourWords")}>
              <p className="text-foreground">{goal.aiSummary}</p>
            </Info>
          )}
        </div>
        <div className="card">
          <GoalEditor focuses={goal.focuses} targetDate={goal.targetDate} description={goal.description} today={today} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">{t("goalView.sectionVolume")}</h2>
          <Info title={t("offseason.toggleLabel")}>
            <p>{t("goalView.modeInfo")}</p>
          </Info>
        </div>
        <ModeToggle offseason={Boolean(off)} />
        <FrameCard frame={frame} off={off} today={today} t={t} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">{t("goalView.sectionProgress")}</h2>
          <Info title={t("goalView.sectionProgress")}>
            <p>{t("goalView.progressInfo")}</p>
          </Info>
        </div>
        {goal.testKeys.map((k) => (
          <ProgressCard key={k} testKey={k} goal={goal} tests={tests} today={today} t={t} />
        ))}
      </div>

      <GoalArchive goals={archive} t={t} />
    </section>
  );
}
