import type { GOAL_TYPES, EQUIPMENT_OPTIONS } from "./schema";

type GoalType = (typeof GOAL_TYPES)[number];
type Equipment = (typeof EQUIPMENT_OPTIONS)[number];

/**
 * Selbsttests, die man ohne Labor durchführen kann, je Ziel. Auswahl nach Studienlage:
 * - Yo-Yo Intermittent Recovery Test 1: für Fußball validiert, Test-Retest-Variation ~4,9 %
 *   (Krustrup et al. 2003, MSSE).
 * - 12-Minuten-Lauf (Cooper-Test): klassischer Feldtest der Ausdauer, ohne Audio möglich.
 * - Sprungtests per Smartphone (My Jump): valide und reliabel für die Sprunghöhe (Meta-Analyse 2023).
 * - 30-m-Sprint: Standardtest der Linearschnelligkeit im Fußball; Zeitnahme per Zeitlupenvideo.
 * - Einbeiniger Weitsprung mit Seitenvergleich (Limb Symmetry Index) und Y-Balance-Test:
 *   gebräuchliche Screenings in der Verletzungsprävention und beim Return-to-Play.
 * Die Tests ersetzen keine ärztliche Freigabe.
 */
export const TEST_KEYS = ["yoyo_ir1", "cooper12", "sprint30", "cmj", "single_leg_hop", "y_balance"] as const;
export type TestKey = (typeof TEST_KEYS)[number];

export interface SelfTest {
  key: TestKey;
  unit: string;
  lowerIsBetter: boolean;
  /** Was mindestens gebraucht wird; leer = überall machbar. */
  needs: Equipment[];
}

export const SELF_TESTS: Record<TestKey, SelfTest> = {
  yoyo_ir1: { key: "yoyo_ir1", unit: "m", lowerIsBetter: false, needs: ["pitch"] },
  cooper12: { key: "cooper12", unit: "m", lowerIsBetter: false, needs: ["outdoor"] },
  sprint30: { key: "sprint30", unit: "s", lowerIsBetter: true, needs: ["pitch"] },
  cmj: { key: "cmj", unit: "cm", lowerIsBetter: false, needs: [] },
  single_leg_hop: { key: "single_leg_hop", unit: "%", lowerIsBetter: false, needs: [] },
  y_balance: { key: "y_balance", unit: "%", lowerIsBetter: false, needs: [] },
};

/** Geeignete Tests je Ziel, wichtigster zuerst. */
const BY_GOAL: Record<GoalType, TestKey[]> = {
  endurance: ["yoyo_ir1", "cooper12"],
  speed: ["sprint30", "cmj"],
  strength: ["cmj", "single_leg_hop"],
  prevention: ["single_leg_hop", "y_balance"],
  comeback: ["single_leg_hop", "cooper12", "y_balance"],
};

/**
 * Testvorschläge für ein Ziel. Tests, deren Voraussetzungen fehlen, kommen ans Ende
 * (z. B. Yo-Yo ohne Platz), statt ganz zu verschwinden.
 */
export function suggestTests(type: GoalType, equipment: Equipment[]): SelfTest[] {
  const possible = (t: SelfTest) => t.needs.every((n) => equipment.includes(n));
  const tests = BY_GOAL[type].map((k) => SELF_TESTS[k]);
  return [...tests.filter(possible), ...tests.filter((t) => !possible(t))];
}
