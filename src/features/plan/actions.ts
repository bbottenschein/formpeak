"use server";

import { revalidatePath } from "next/cache";
import { addDays, mondayOf } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { getGoal } from "@/features/goals/queries";
import { computeMetricsFor } from "@/features/today/metrics";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { planWeek } from "./generate";

const isMonday = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && mondayOf(d) === d;

async function run(weekStart: string, force: boolean) {
  if (!isMonday(weekStart)) return { ok: false };
  const user = await getCurrentUser();
  const today = userToday(user.timezone);
  if (addDays(weekStart, 6) < today) return { ok: false };
  const inWeek = today >= weekStart && today <= addDays(weekStart, 6);
  const [goal, todayMetrics] = await Promise.all([
    getGoal(user.id),
    inWeek ? computeMetricsFor(user.id, today, today) : Promise.resolve(null),
  ]);
  const ok = await planWeek({
    supabase: await createClient(),
    userId: user.id,
    weekStart,
    today,
    goal,
    todayMetrics,
    t: getT(user.locale),
    force,
  });
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/week");
  return { ok };
}

/** Plant die Woche, falls noch kein Plan existiert (automatisch beim Öffnen von Heute/Kalender). */
export async function ensureWeekPlan(weekStart: string) {
  return run(weekStart, false);
}

/** „Woche neu planen“: ersetzt offene Vorschläge ab heute. */
export async function replanWeek(weekStart: string) {
  await run(weekStart, true);
}
