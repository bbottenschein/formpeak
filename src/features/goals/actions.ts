"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { goalSchema } from "./schema";

export type GoalState = { error?: string };

/** Speichert Ziel (ein aktives Ziel, wird ersetzt) und Trainingsrahmen im Profil. */
export async function saveGoal(_prev: GoalState, formData: FormData): Promise<GoalState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  let parsed;
  try {
    parsed = goalSchema.safeParse(JSON.parse(String(formData.get("payload") ?? "")));
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
    test_name: g.testName,
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
  const { error: goalError } = existing
    ? await supabase.from("goals").update(goalRow).eq("id", existing.id)
    : await supabase.from("goals").insert({ ...goalRow, user_id: user.id, active: true, priority: 1 });

  if (profileError || goalError) {
    console.error("[goals] nicht gespeichert", profileError?.message, goalError?.message);
    return { error: t("goal.errorSave") };
  }
  revalidatePath("/", "layout");
  redirect("/");
}
