import type { Metadata } from "next";
import { addDays } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { getGoal } from "@/features/goals/queries";
import { OffseasonForm } from "@/features/offseason/offseason-form";
import { getOffseason } from "@/features/offseason/queries";
import type { OffseasonInput } from "@/features/offseason/schema";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Off-Season" };

/** Off-Season starten oder anpassen (Klick-Through). */
export default async function OffseasonPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const supabase = await createClient();
  const [active, { frame }] = await Promise.all([getOffseason(supabase, user.id, today), getGoal(user.id)]);

  const initial: OffseasonInput = active
    ? {
        preseasonStart: active.phase.endsOn ? addDays(active.phase.endsOn, 1) : null,
        recoveryWeeks: active.phase.recoveryWeeks,
        extraSessionsPerWeek: Math.max(1, active.frame.extraSessionsPerWeek),
        availableWeekdays: active.frame.availableWeekdays,
        timeBudgetMin: active.frame.timeBudgetMin,
        equipment: active.frame.equipment,
      }
    : {
        preseasonStart: null,
        recoveryWeeks: 1,
        extraSessionsPerWeek: Math.min(6, Math.max(1, (frame?.extraSessionsPerWeek ?? 2) + 1)),
        availableWeekdays: [],
        timeBudgetMin: frame?.timeBudgetMin ?? 60,
        equipment: frame?.equipment ?? [],
      };

  return (
    <section className="flex flex-col gap-6">
      <p className="eyebrow">{t("offseason.wizard.title")}</p>
      <OffseasonForm initial={initial} today={active?.phase.startsOn ?? today} editing={Boolean(active)} />
    </section>
  );
}
