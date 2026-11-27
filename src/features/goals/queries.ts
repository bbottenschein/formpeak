import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TestEntry } from "./progress";
import type { GoalInput } from "./schema";
import type { TestKey } from "./tests";

export interface GoalData {
  goal: GoalInput | null;
  /** Rahmen aus dem Profil, auch ohne Ziel vorhanden. */
  frame: Pick<GoalInput, "extraSessionsPerWeek" | "timeBudgetMin" | "availableWeekdays" | "equipment"> | null;
}

/** Aktives Ziel und Trainingsrahmen des Nutzers. */
export async function getGoal(userId: string): Promise<GoalData> {
  const supabase = await createClient();
  const [{ data: goal }, { data: profile }] = await Promise.all([
    supabase
      .from("goals")
      .select("type, description, test_key, test_name, baseline_value, target_value, unit, target_date, ai_summary")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("extra_sessions_per_week, time_budget_min, available_weekdays, equipment")
      .eq("id", userId)
      .single(),
  ]);

  const frame =
    profile && profile.extra_sessions_per_week != null && profile.time_budget_min != null
      ? {
          extraSessionsPerWeek: profile.extra_sessions_per_week,
          timeBudgetMin: profile.time_budget_min,
          availableWeekdays: profile.available_weekdays,
          equipment: profile.equipment as GoalInput["equipment"],
        }
      : null;

  return {
    frame,
    goal:
      goal && frame
        ? {
            type: goal.type,
            description: goal.description ?? "",
            testKey: goal.test_key,
            testName: goal.test_name,
            aiSummary: goal.ai_summary,
            baselineValue: goal.baseline_value == null ? null : Number(goal.baseline_value),
            targetValue: goal.target_value == null ? null : Number(goal.target_value),
            unit: goal.unit,
            targetDate: goal.target_date,
            ...frame,
          }
        : null,
  };
}

/** Aktives Ziel mit Id und allen Referenztests. */
export async function getGoalWithTests(userId: string) {
  const supabase = await createClient();
  const { data: goal } = await supabase
    .from("goals")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (!goal) return { goalId: null, tests: [] as TestEntry[] };
  const { data } = await supabase
    .from("goal_tests")
    .select("id, test_key, status, date, scheduled_for, value")
    .eq("goal_id", goal.id)
    .order("created_at");
  return {
    goalId: goal.id as string,
    tests: (data ?? []).map(
      (r): TestEntry => ({
        id: r.id,
        testKey: r.test_key as TestKey,
        status: r.status,
        date: r.date,
        scheduledFor: r.scheduled_for,
        value: r.value == null ? null : Number(r.value),
      }),
    ),
  };
}
