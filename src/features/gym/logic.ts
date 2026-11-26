import type { TrafficLight } from "@/core/load";

export type SetType = "warmup" | "working";

export interface GymSet {
  weightKg: number;
  reps: number;
  rir: number | null;
  setType: SetType;
}

/** Geschätztes Maximalgewicht nach Epley: Gewicht × (1 + Wdh / 30). */
export function epley1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Bestes geschätztes 1RM aus den Arbeitssätzen, auf 0,5 kg gerundet. */
export function best1rm(sets: GymSet[]): number {
  const best = Math.max(0, ...sets.filter((s) => s.setType === "working").map((s) => epley1rm(s.weightKg, s.reps)));
  return roundToHalf(best);
}

/** Volumen (kg × Wdh) der Arbeitssätze. */
export function volume(sets: GymSet[]): number {
  return sets.filter((s) => s.setType === "working").reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

export const roundToHalf = (x: number) => Math.round(x * 2) / 2;

export const PROGRESSION_STEP_KG = 2.5;
export const MIN_RIR_FOR_PROGRESSION = 2;

export interface Suggestion {
  weightKg: number;
  reps: number;
  sets: number;
  reason: "progress" | "repeat" | "reduce" | "bodyweight";
}

/**
 * Vorschlag für die nächste Einheit einer Übung (SPEC 3.5):
 * - Alle Arbeitssätze mit RIR ≥ 2 geschafft → +2,5 kg (bei Gewicht > 0).
 * - Sonst gleiches Gewicht und gleiche Wiederholungen.
 * - Gelbe Ampel → ein Arbeitssatz weniger (mindestens 1), Gewicht nicht steigern.
 * - Rote Ampel → kein Vorschlag (heute keine Krafteinheit).
 */
export function suggestNext(lastSets: GymSet[], light?: TrafficLight): Suggestion | null {
  const working = lastSets.filter((s) => s.setType === "working");
  if (working.length === 0 || light === "red") return null;

  // Referenz: der schwerste Arbeitssatz, bei Gleichstand der mit mehr Wiederholungen.
  const top = working.reduce((a, b) => (b.weightKg > a.weightKg || (b.weightKg === a.weightKg && b.reps > a.reps) ? b : a));
  const allEasy = working.every((s) => s.rir != null && s.rir >= MIN_RIR_FOR_PROGRESSION);

  if (light === "yellow") {
    return { weightKg: top.weightKg, reps: top.reps, sets: Math.max(1, working.length - 1), reason: "reduce" };
  }
  if (top.weightKg === 0) {
    return { weightKg: 0, reps: allEasy ? top.reps + 1 : top.reps, sets: working.length, reason: "bodyweight" };
  }
  if (allEasy) {
    return { weightKg: top.weightKg + PROGRESSION_STEP_KG, reps: top.reps, sets: working.length, reason: "progress" };
  }
  return { weightKg: top.weightKg, reps: top.reps, sets: working.length, reason: "repeat" };
}

/** Sätze aus einem Vorschlag (für „Vorschlag übernehmen“). */
export function setsFromSuggestion(s: Suggestion): GymSet[] {
  return Array.from({ length: s.sets }, () => ({ weightKg: s.weightKg, reps: s.reps, rir: null, setType: "working" as const }));
}
