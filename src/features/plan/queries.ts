import "server-only";
import { createClient } from "@/lib/supabase/server";
import { inferMeasure, type Measure } from "@/features/training/prescription";
import type { PlannedExercise } from "./types";

export interface WeekPlanStatus {
  status: "pending" | "ready" | "failed";
  source: "ai" | "rules" | null;
  focus: string | null;
  adjusted: boolean;
  /** Seit Minuten „pending“ – die Erstellung ist abgebrochen und darf neu starten. */
  stale: boolean;
}

/** Nach dieser Zeit gilt eine laufende Erstellung als abgebrochen (siehe generate.ts). */
export const STALE_PENDING_MS = 4 * 60_000;

/** Status für den Auto-Start: kein Plan oder abgebrochene Erstellung → neu starten. */
export function autoStartStatus(plan: WeekPlanStatus | null): "none" | "pending" | "failed" {
  if (!plan || plan.stale) return "none";
  return plan.status === "ready" ? "none" : plan.status;
}

/** Status des Wochenplans (null = noch nie geplant). */
export async function getWeekPlan(userId: string, weekStart: string): Promise<WeekPlanStatus | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("week_plans")
    .select("status, source, focus, adjusted, updated_at")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!data) return null;
  return {
    status: data.status,
    source: data.source,
    focus: data.focus,
    adjusted: data.adjusted,
    stale: data.status === "pending" && Date.now() - Date.parse(data.updated_at) > STALE_PENDING_MS,
  };
}

/** Übungen der vorgeschlagenen Einheiten, nach Einheit gruppiert. */
export async function getPlannedExercises(sessionIds: string[]): Promise<Record<string, PlannedExercise[]>> {
  if (sessionIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("planned_exercises")
    .select("session_id, position, name, prescription, how, exercise_id, measure, exercises(equipment)")
    .in("session_id", sessionIds)
    .order("position");
  const out: Record<string, PlannedExercise[]> = {};
  for (const r of data ?? []) {
    (out[r.session_id] ??= []).push({
      name: r.name,
      prescription: r.prescription ?? "",
      how: r.how ?? "",
      exerciseId: r.exercise_id,
      measure:
        (r.measure as Measure | null) ??
        inferMeasure(r.prescription ?? "", (r.exercises as unknown as { equipment: string } | null)?.equipment ?? null),
    });
  }
  return out;
}
