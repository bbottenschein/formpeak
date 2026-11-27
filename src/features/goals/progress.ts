import { addDays, diffDays, type IsoDate } from "@/core/load";
import { epley1rm } from "@/features/gym/logic";
import type { TestKey } from "./tests";

/** Abstand zwischen zwei Referenztests (docs/AENDERUNGEN.md: nach 5 Wochen). */
export const RETEST_INTERVAL_DAYS = 35;

export interface TestEntry {
  id: string;
  testKey: TestKey;
  status: "planned" | "done" | "skipped";
  date: IsoDate | null;
  scheduledFor: IsoDate | null;
  value: number | null;
}

/** Nächster Testtermin nach einem durchgeführten Test. */
export function nextTestDate(doneOn: IsoDate): IsoDate {
  return addDays(doneOn, RETEST_INTERVAL_DAYS);
}

export interface TestSchedule {
  /** Geplanter nächster Test (oder null, wenn keiner geplant ist). */
  next: TestEntry | null;
  /** Tage bis zum nächsten Test (negativ = überfällig). */
  daysUntil: number | null;
  /** Durchgeführte Tests, älteste zuerst. */
  done: TestEntry[];
}

export function testSchedule(tests: TestEntry[], today: IsoDate): TestSchedule {
  const done = tests
    .filter((t) => t.status === "done" && t.date && t.value != null)
    .sort((a, b) => a.date!.localeCompare(b.date!));
  const next =
    tests
      .filter((t) => t.status === "planned" && t.scheduledFor)
      .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!))[0] ?? null;
  return { next, daysUntil: next ? diffDays(today, next.scheduledFor!) : null, done };
}

export interface Progress {
  /** Erster und letzter Wert. */
  first: number;
  latest: number;
  /** Veränderung in Einheiten (positiv = besser, unabhängig von der Richtung). */
  improvement: number;
  /** Veränderung in Prozent des Ausgangswerts (positiv = besser). */
  improvementPct: number;
  /** Anteil des Wegs zum Zielwert (0–100), null ohne Zielwert. */
  towardTargetPct: number | null;
}

/** Vorher-nachher aus den durchgeführten Tests. Mindestens zwei Werte, sonst null. */
export function progress(
  values: number[],
  target: number | null,
  lowerIsBetter: boolean,
): Progress | null {
  if (values.length < 2) return null;
  const first = values[0];
  const latest = values[values.length - 1];
  const sign = lowerIsBetter ? -1 : 1;
  const improvement = Math.round((latest - first) * sign * 100) / 100;
  const improvementPct = first === 0 ? 0 : Math.round(((latest - first) / Math.abs(first)) * sign * 1000) / 10;
  let towardTargetPct: number | null = null;
  if (target != null && target !== first) {
    const share = (latest - first) / (target - first);
    towardTargetPct = Math.round(Math.min(1, Math.max(0, share)) * 100);
  }
  return { first, latest, improvement, improvementPct, towardTargetPct };
}

/** Geschätztes 1RM aus einem 5-Wiederholungs-Maximum (für Kraft-Tests). */
export function estimated1rmFrom5rm(weightKg: number): number {
  return Math.round(epley1rm(weightKg, 5) * 2) / 2;
}
