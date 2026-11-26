import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { GoalInput } from "./schema";

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
