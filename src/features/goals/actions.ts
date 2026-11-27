"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { mondayOf, userToday } from "@/lib/date";
import { summarizeGoal, type GoalContext, type GoalSummaryResult } from "./ai";
import { scheduleFinalTest } from "./lifecycle";
import { nextTestDate } from "./progress";
import { GOAL_TYPES, goalSaveSchema, type GoalType } from "./schema";
import { suggestTests, TEST_KEYS, type TestKey } from "./tests";

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

  const testKeys = [...new Set(g.testKeys.length ? g.testKeys : g.testKey ? [g.testKey] : [])];
  const goalRow = {
    type: g.focuses[0],
    focuses: [...new Set(g.focuses)],
    test_keys: testKeys,
    targets: Object.fromEntries(Object.entries(g.targets).filter(([k]) => testKeys.includes(k as TestKey))),
    description: g.description,
    test_key: testKeys[0] ?? null,
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
        .insert({ ...goalRow, user_id: user.id, active: true, priority: 1, starts_on: userToday(user.timezone) })
        .select("id")
        .single();

  if (profileError || goalError || !saved) {
    console.error("[goals] nicht gespeichert", profileError?.message, goalError?.message);
    return { error: t("goal.errorSave") };
  }

  const today = userToday(user.timezone);
  for (const [i, key] of testKeys.entries()) {
    await planReferenceTests(saved.id, key, i === 0 ? g.baselineValue : null, user.id, today, testKeys);
  }
  await scheduleFinalTest(supabase, user.id, saved.id, testKeys, g.targetDate, today, t);
  // Neues Ziel oder neuer Rahmen: Wochenpläne ab dieser Woche neu erstellen lassen
  // (beim nächsten Öffnen von Heute/Kalender; offene Vorschläge werden dabei ersetzt).
  await supabase.from("week_plans").delete().eq("user_id", user.id).gte("week_start", mondayOf(userToday(user.timezone)));
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
  activeKeys: TestKey[] = [testKey],
) {
  const supabase = await createClient();
  // Offene Termine von Tests, die nicht mehr zum Ziel gehören, entfallen.
  await supabase
    .from("goal_tests")
    .update({ status: "skipped" })
    .eq("goal_id", goalId)
    .eq("status", "planned")
    .not("test_key", "in", `(${activeKeys.join(",")})`);

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

/** Pläne ab dieser Woche neu erstellen lassen (Ziel geändert). */
async function resetPlans(userId: string, today: string) {
  const supabase = await createClient();
  await supabase.from("week_plans").delete().eq("user_id", userId).gte("week_start", mondayOf(today));
  revalidatePath("/", "layout");
}

async function activeGoal() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: goal } = await supabase
    .from("goals")
    .select("id, focuses, test_keys, target_date")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  return { user, supabase, goal };
}

/** Sofort-Änderung: Schwerpunkte (1–3). Neue Schwerpunkte bekommen einen passenden Referenztest. */
export async function updateGoalFocuses(focuses: GoalType[]): Promise<{ ok: boolean }> {
  const list = [...new Set(focuses)].filter((f) => (GOAL_TYPES as readonly string[]).includes(f));
  if (list.length < 1 || list.length > 3) return { ok: false };
  const { user, supabase, goal } = await activeGoal();
  if (!goal) return { ok: false };
  const { data: profile } = await supabase.from("profiles").select("equipment").eq("id", user.id).single();
  const equipment = (profile?.equipment ?? []) as Parameters<typeof suggestTests>[1];
  const old = (goal.test_keys ?? []) as TestKey[];
  const keys: TestKey[] = [];
  for (const f of list) {
    const options = suggestTests(f, equipment).map((x) => x.key);
    const keep = old.find((k) => options.includes(k) && !keys.includes(k));
    const pick = keep ?? options.find((k) => !keys.includes(k));
    if (pick) keys.push(pick);
  }
  const today = userToday(user.timezone);
  await supabase.from("goals").update({ focuses: list, type: list[0], test_keys: keys, test_key: keys[0] ?? null }).eq("id", goal.id);
  for (const k of keys) await planReferenceTests(goal.id, k, null, user.id, today, keys);
  await scheduleFinalTest(supabase, user.id, goal.id, keys, goal.target_date, today, getT(user.locale));
  await resetPlans(user.id, today);
  return { ok: true };
}

/** Sofort-Änderung: Zieldatum (Ende des Zeitraums); der Abschlusstest wandert mit. */
export async function updateGoalDate(date: string | null): Promise<{ ok: boolean }> {
  if (date != null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false };
  const { user, supabase, goal } = await activeGoal();
  const today = userToday(user.timezone);
  if (!goal || (date != null && date <= today)) return { ok: false };
  await supabase.from("goals").update({ target_date: date }).eq("id", goal.id);
  await scheduleFinalTest(supabase, user.id, goal.id, (goal.test_keys ?? []) as TestKey[], date, today, getT(user.locale));
  await resetPlans(user.id, today);
  return { ok: true };
}

/** Sofort-Änderung: Beschreibung in eigenen Worten. */
export async function updateGoalDescription(text: string): Promise<{ ok: boolean }> {
  const description = text.trim().slice(0, 500);
  if (description.length < 3) return { ok: false };
  const { supabase, goal } = await activeGoal();
  if (!goal) return { ok: false };
  await supabase.from("goals").update({ description, ai_summary: null }).eq("id", goal.id);
  revalidatePath("/goals");
  return { ok: true };
}
