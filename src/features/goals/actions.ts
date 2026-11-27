"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { userToday } from "@/lib/date";
import { summarizeGoal, type GoalContext, type GoalSummaryResult } from "./ai";
import { nextTestDate } from "./progress";
import { goalSaveSchema } from "./schema";
import { TEST_KEYS, type TestKey } from "./tests";

export type GoalState = { error?: string };

/** Speichert Ziel (ein aktives Ziel, wird ersetzt) und Trainingsrahmen im Profil. */
export async function saveGoal(_prev: GoalState, formData: FormData): Promise<GoalState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  let parsed;
  try {
    parsed = goalSaveSchema.safeParse(JSON.parse(String(formData.get("payload") ?? "")));
  } catch {
    return { error: t("goal.errorInvalid") };
  }
  if (!parsed.success) return { error: t("goal.errorInvalid") };
  const g = parsed.data;
  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      extra_sessions_per_week: g.extraSessionsPerWeek,
      time_budget_min: g.timeBudgetMin,
      available_weekdays: [...new Set(g.availableWeekdays)].sort(),
      equipment: [...new Set(g.equipment)],
    })
    .eq("id", user.id);

  const goalRow = {
    type: g.type,
    description: g.description,
    test_key: g.testKey,
    test_name: g.testKey ? t(`goal.tests.${g.testKey}.name`) : g.testName,
    ai_summary: g.aiSummary,
    baseline_value: g.baselineValue,
    target_value: g.targetValue,
    unit: g.unit,
    target_date: g.targetDate,
  };
  const { data: existing } = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  const { data: saved, error: goalError } = existing
    ? await supabase.from("goals").update(goalRow).eq("id", existing.id).select("id").single()
    : await supabase
        .from("goals")
        .insert({ ...goalRow, user_id: user.id, active: true, priority: 1 })
        .select("id")
        .single();

  if (profileError || goalError || !saved) {
    console.error("[goals] nicht gespeichert", profileError?.message, goalError?.message);
    return { error: t("goal.errorSave") };
  }

  if (g.testKey) await planReferenceTests(saved.id, g.testKey, g.baselineValue, user.id, userToday(user.timezone));
  revalidatePath("/", "layout");
  redirect("/goals");
}

/**
 * Referenztests planen (docs/AENDERUNGEN.md › Ziel): erster Test zum Start, danach alle 5 Wochen.
 * Ist ein Ausgangswert bekannt, zählt er als erster Test von heute.
 * Wechselt der Test, werden offene Termine des alten Tests übersprungen.
 */
async function planReferenceTests(
  goalId: string,
  testKey: TestKey,
  baseline: number | null,
  userId: string,
  today: string,
) {
  const supabase = await createClient();
  await supabase
    .from("goal_tests")
    .update({ status: "skipped" })
    .eq("goal_id", goalId)
    .eq("status", "planned")
    .neq("test_key", testKey);

  const { data: existing } = await supabase
    .from("goal_tests")
    .select("id, status")
    .eq("goal_id", goalId)
    .eq("test_key", testKey)
    .in("status", ["planned", "done"]);
  if (existing?.length) return;

  if (baseline != null) {
    await supabase.from("goal_tests").insert([
      { user_id: userId, goal_id: goalId, test_key: testKey, status: "done", date: today, value: baseline },
      { user_id: userId, goal_id: goalId, test_key: testKey, status: "planned", scheduled_for: nextTestDate(today) },
    ]);
  } else {
    await supabase
      .from("goal_tests")
      .insert({ user_id: userId, goal_id: goalId, test_key: testKey, status: "planned", scheduled_for: today });
  }
}

export type TestResultState = { error?: string; ok?: boolean };

/** Ergebnis eines Referenztests eintragen; plant den nächsten Test in 5 Wochen. */
export async function recordTestResult(
  testId: string,
  _prev: TestResultState,
  formData: FormData,
): Promise<TestResultState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const value = Number(String(formData.get("value") ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value <= 0 || value > 100000) return { error: t("goal.resultInvalid") };

  const supabase = await createClient();
  const { data: test } = await supabase
    .from("goal_tests")
    .select("id, goal_id, test_key, status")
    .eq("id", testId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!test || !(TEST_KEYS as readonly string[]).includes(test.test_key)) return { error: t("goal.resultInvalid") };

  const today = userToday(user.timezone);
  const { error } = await supabase
    .from("goal_tests")
    .update({ status: "done", date: today, value })
    .eq("id", testId);
  if (error) return { error: t("goal.errorSave") };

  // Erster Wert wird Ausgangswert des Ziels.
  const { count } = await supabase
    .from("goal_tests")
    .select("id", { count: "exact", head: true })
    .eq("goal_id", test.goal_id)
    .eq("status", "done");
  if (count === 1) await supabase.from("goals").update({ baseline_value: value }).eq("id", test.goal_id);

  await supabase.from("goal_tests").insert({
    user_id: user.id,
    goal_id: test.goal_id,
    test_key: test.test_key,
    status: "planned",
    scheduled_for: nextTestDate(today),
  });
  revalidatePath("/goals");
  revalidatePath("/week");
  return { ok: true };
}

/** Ziel von der KI formulieren lassen und einen Test vorschlagen (Zusammenfassungs-Schritt). */
export async function previewGoal(ctx: Omit<GoalContext, "today">): Promise<GoalSummaryResult> {
  const user = await getCurrentUser();
  return summarizeGoal({
    ...ctx,
    description: ctx.description.slice(0, 500),
    today: userToday(user.timezone),
  });
}
