import type { GymFocus, PlanKind, PlanUnit } from "@/core/load";

/** Eine Übung im Plan: Vorgabe und genau ein Satz, wie sie geht. */
export interface PlannedExercise {
  name: string;
  prescription: string;
  how: string;
  /** Übung aus der Gym-Bibliothek (für das Gym-Log und die Unterkörper-Regel). */
  exerciseId: string | null;
}

/** Eine vorgeschlagene Einheit, bevor sie als `sessions`-Zeile gespeichert wird. */
export interface PlannedSession extends PlanUnit {
  kind: PlanKind;
  title: string;
  gymFocus: GymFocus | null;
  /** Ein Satz, warum diese Einheit an diesem Tag. */
  reason: string;
  exercises: PlannedExercise[];
}

export interface WeekPlanResult {
  source: "ai" | "rules";
  focus: string;
  sessions: PlannedSession[];
}
