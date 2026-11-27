import type { EQUIPMENT_OPTIONS, GOAL_TYPES } from "./schema";

type GoalType = (typeof GOAL_TYPES)[number];
type Equipment = (typeof EQUIPMENT_OPTIONS)[number];

/**
 * Referenztests je Ziel (docs/AENDERUNGEN.md › Ziel, SPEC 7.1), Quellen in SPEC › Quellen:
 * - Yo-Yo IR1: für Fußball validiert, Test-Retest-Variation ~4,9 % (Krustrup et al. 2003).
 * - 3-km-Lauf: einfacher Ausdauer-Feldtest ohne Audio.
 * - 10-/20-m-Sprint: gute Reliabilität bei Teamsportlern (ICC 0,89–0,95).
 * - Sprunghöhe per App (My Jump): valide und reliabel (Meta-Analyse).
 * - 5-Wiederholungs-Maximum: geschätztes 1RM nach Epley aus dem Gym-Log.
 * - Körpergewicht/Taillenumfang: Wochenschnitt statt Einzelwert.
 * - Einbeiniger Weitsprung (Seitenvergleich), Y-Balance: gebräuchlich in Prävention und Return-to-Play.
 * Die Tests ersetzen keine ärztliche Freigabe.
 */
export const TEST_KEYS = [
  "yoyo_ir1",
  "run3k",
  "sprint10",
  "sprint20",
  "cmj",
  "squat_5rm",
  "bench_5rm",
  "body_weight",
  "waist",
  "single_leg_hop",
  "y_balance",
] as const;
export type TestKey = (typeof TEST_KEYS)[number];

export interface SelfTest {
  key: TestKey;
  unit: string;
  /** Kleiner ist besser (Zeit, Taillenumfang). Beim Körpergewicht hängt es vom Ziel ab. */
  lowerIsBetter: boolean;
  /** Was mindestens gebraucht wird; leer = überall machbar. */
  needs: Equipment[];
}

export const SELF_TESTS: Record<TestKey, SelfTest> = {
  yoyo_ir1: { key: "yoyo_ir1", unit: "m", lowerIsBetter: false, needs: ["pitch"] },
  run3k: { key: "run3k", unit: "min", lowerIsBetter: true, needs: ["outdoor"] },
  sprint10: { key: "sprint10", unit: "s", lowerIsBetter: true, needs: ["pitch"] },
  sprint20: { key: "sprint20", unit: "s", lowerIsBetter: true, needs: ["pitch"] },
  cmj: { key: "cmj", unit: "cm", lowerIsBetter: false, needs: [] },
  squat_5rm: { key: "squat_5rm", unit: "kg", lowerIsBetter: false, needs: ["gym"] },
  bench_5rm: { key: "bench_5rm", unit: "kg", lowerIsBetter: false, needs: ["gym"] },
  body_weight: { key: "body_weight", unit: "kg", lowerIsBetter: true, needs: [] },
  waist: { key: "waist", unit: "cm", lowerIsBetter: true, needs: [] },
  single_leg_hop: { key: "single_leg_hop", unit: "%", lowerIsBetter: false, needs: [] },
  y_balance: { key: "y_balance", unit: "%", lowerIsBetter: false, needs: [] },
};

/** Geeignete Tests je Ziel, wichtigster zuerst. */
const BY_GOAL: Record<GoalType, TestKey[]> = {
  endurance: ["yoyo_ir1", "run3k"],
  speed: ["sprint10", "sprint20", "cmj"],
  strength: ["squat_5rm", "bench_5rm", "cmj"],
  muscle_gain: ["squat_5rm", "bench_5rm", "body_weight"],
  weight_loss: ["body_weight", "waist"],
  prevention: ["single_leg_hop", "y_balance"],
  comeback: ["single_leg_hop", "y_balance", "run3k"],
};

/** Ob ein kleinerer Wert besser ist – beim Körpergewicht abhängig vom Ziel. */
export function lowerIsBetter(test: TestKey, goal: GoalType): boolean {
  if (test === "body_weight") return goal !== "muscle_gain";
  return SELF_TESTS[test].lowerIsBetter;
}

/**
 * Testvorschläge für ein Ziel. Tests, deren Voraussetzungen fehlen, kommen ans Ende
 * (z. B. Yo-Yo ohne Platz), statt ganz zu verschwinden.
 */
export function suggestTests(type: GoalType, equipment: Equipment[]): SelfTest[] {
  const possible = (t: SelfTest) => t.needs.every((n) => equipment.includes(n));
  const tests = BY_GOAL[type].map((k) => SELF_TESTS[k]);
  return [...tests.filter(possible), ...tests.filter((t) => !possible(t))];
}
