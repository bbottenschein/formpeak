"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays, mondayOf } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { userToday } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import { getOffseason } from "./queries";
import { offseasonSchema, type OffseasonInput } from "./schema";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function refresh() {
  for (const p of ["/", "/today", "/week", "/goals", "/settings"]) revalidatePath(p);
}

/** Wochenpläne ab dieser Woche verwerfen – sie entstehen beim nächsten Öffnen neu. */
async function resetPlans(supabase: Supabase, userId: string, today: string) {
  await supabase.from("week_plans").delete().eq("user_id", userId).gte("week_start", mondayOf(today));
}

/**
 * Referenztests in der Pause: einer zum Start des Aufbaus, einer in der letzten Woche vor der
 * Vorbereitung (wenn bekannt). So zeigt die Pause schwarz auf weiß, was sie gebracht hat.
 */
async function planPauseTests(supabase: Supabase, userId: string, startOfBuild: string, endsOn: string | null) {
  const { data: goal } = await supabase
    .from("goals")
    .select("id, test_key")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (!goal?.test_key) return;
  await supabase.from("goal_tests").delete().eq("goal_id", goal.id).eq("status", "planned");
  const dates = [startOfBuild];
  if (endsOn && addDays(endsOn, -6) > addDays(startOfBuild, 14)) dates.push(addDays(endsOn, -6));
  await supabase.from("goal_tests").insert(
    dates.map((d) => ({ user_id: userId, goal_id: goal.id, test_key: goal.test_key, scheduled_for: d, status: "planned" })),
  );
}

/** Off-Season starten oder anpassen. */
export async function saveOffseason(input: OffseasonInput): Promise<{ error?: boolean }> {
  const parsed = offseasonSchema.safeParse(input);
  const user = await getCurrentUser();
  const today = userToday(user.timezone);
  if (!parsed.success || (parsed.data.preseasonStart && parsed.data.preseasonStart <= today)) return { error: true };
  const o = parsed.data;
  const supabase = await createClient();
  const endsOn = o.preseasonStart ? addDays(o.preseasonStart, -1) : null;
  const row = {
    ends_on: endsOn,
    recovery_weeks: o.recoveryWeeks,
    extra_sessions_per_week: o.extraSessionsPerWeek,
    available_weekdays: [...new Set(o.availableWeekdays)].sort(),
    time_budget_min: o.timeBudgetMin,
    equipment: [...new Set(o.equipment)],
  };
  const active = await getOffseason(supabase, user.id, today);
  const { error } = active
    ? await supabase.from("season_phases").update(row).eq("id", active.id).eq("user_id", user.id)
    : await supabase.from("season_phases").insert({ ...row, user_id: user.id, kind: "break", starts_on: today });
  if (error) {
    console.error("[offseason] nicht gespeichert", error.message);
    return { error: true };
  }

  // Feste Trainings und Spiele im Zeitraum fallen weg (nicht erledigte); danach legt die App sie
  // dort nicht mehr an. Nach der Pause entstehen sie automatisch wieder.
  let del = supabase.from("sessions").delete().eq("user_id", user.id).eq("is_fixture", true).eq("status", "planned").gte("date", today);
  if (endsOn) del = del.lte("date", endsOn);
  await del;

  if (!active) await planPauseTests(supabase, user.id, addDays(today, o.recoveryWeeks * 7), endsOn);
  await resetPlans(supabase, user.id, today);
  refresh();
  redirect("/");
}

/** Off-Season beenden: ab heute gilt wieder der Season-Modus mit festen Terminen. */
export async function endOffseason() {
  const user = await getCurrentUser();
  const today = userToday(user.timezone);
  const supabase = await createClient();
  const active = await getOffseason(supabase, user.id, today);
  if (active) {
    if (active.phase.startsOn >= today) {
      await supabase.from("season_phases").delete().eq("id", active.id).eq("user_id", user.id);
    } else {
      await supabase.from("season_phases").update({ ends_on: addDays(today, -1) }).eq("id", active.id).eq("user_id", user.id);
    }
    await resetPlans(supabase, user.id, today);
  }
  refresh();
  redirect("/");
}
