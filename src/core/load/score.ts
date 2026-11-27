import { LOAD_CONFIG, type LoadConfig } from "./config";
import { addDays, type IsoDate } from "./dates";
import type { ReadinessFactor, ReadinessResult } from "./readiness";

export type ScoreComponentKey = ReadinessFactor | "load";

export interface ScoreComponent {
  key: ScoreComponentKey;
  /** Anteil am Score in Prozent nach Umverteilung (0 für die Belastungskorrektur). */
  weight: number;
  /** Teilwert 0–100; null = heute nicht verfügbar (z. B. kein Ruhepuls). */
  value: number | null;
  /** Beitrag in Punkten zum Score. Bei der Belastung: Korrektur (≤ 0). */
  points: number;
  /** Punkte, die gegenüber dem Bestwert fehlen (0 = Bestwert erreicht). */
  lost: number;
}

export type ScoreMood = "good" | "medium" | "low";

export interface PerformanceScore {
  /** Performance-Score 0–100 (Erholung minus Belastungskorrektur). */
  score: number;
  /** Erholung aus dem Morgen-Check-in (= Readiness). */
  recovery: number;
  /** Abzug durch die Belastung (0, 10 oder 20). */
  correction: number;
  components: ScoreComponent[];
  mood: ScoreMood;
}

const ORDER: ReadinessFactor[] = ["sleepDuration", "sleepQuality", "energy", "soreness", "stress", "restingHr"];
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Abzug durch die Belastung (SPEC 4.3a): ACWR > 1,3 → 10, > 1,5 → 20, sonst 0. */
export function loadCorrection(acwr: number | null, config: LoadConfig = LOAD_CONFIG): number {
  if (acwr == null) return 0;
  if (acwr > config.acwr.yellow) return config.score.spikeCorrection;
  if (acwr > config.acwr.green) return config.score.elevatedCorrection;
  return 0;
}

/**
 * Performance-Score mit Aufschlüsselung pro Baustein (SPEC 4.3/4.3a).
 * Gewichte der verfügbaren Bausteine werden auf 100 % hochskaliert (wie in der Readiness).
 */
export function computePerformanceScore(
  readiness: ReadinessResult,
  acwr: number | null,
  config: LoadConfig = LOAD_CONFIG,
): PerformanceScore {
  const weights = config.readiness.weights;
  const total = ORDER.reduce((sum, k) => (readiness.factors[k] == null ? sum : sum + weights[k]), 0);

  const components: ScoreComponent[] = ORDER.map((key) => {
    const value = readiness.factors[key];
    if (value == null) return { key, weight: 0, value: null, points: 0, lost: 0 };
    const weight = (weights[key] / total) * 100;
    return {
      key,
      weight: round1(weight),
      value: Math.round(value),
      points: round1((weight * value) / 100),
      lost: round1((weight * (100 - value)) / 100),
    };
  });

  const correction = loadCorrection(acwr, config);
  components.push({ key: "load", weight: 0, value: null, points: -correction, lost: correction });

  const recovery = readiness.score;
  const score = Math.max(0, recovery - correction);
  const mood: ScoreMood = score >= config.readiness.green ? "good" : score >= config.readiness.yellow ? "medium" : "low";
  return { score, recovery, correction, components, mood };
}

/** Größter Abzug heute (für den Satz „Dein Schlaf zieht den Score um 5 Punkte runter“). */
export function biggestDrag(score: PerformanceScore, minPoints = 3): ScoreComponent | null {
  const candidates = score.components.filter((c) => c.lost >= minPoints);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.lost > a.lost ? b : a));
}

/* ------------------------------------------------- Vergleich mit dem Normalwert */

/** Belastung der letzten 7 Tage im Vergleich zum Wochenschnitt der 3 Wochen davor, in % (ACWR − 1). */
export function loadVsNormal(acwr: number | null): number | null {
  return acwr == null ? null : Math.round((acwr - 1) * 100);
}

export interface StressEntry {
  date: IsoDate;
  stress: number;
}

/**
 * Stress der letzten 7 Tage (Morgen- und Abendwerte) im Vergleich zum Mittel der 3 Wochen davor,
 * in Prozent (SPEC 4.3b). Mindestens 3 Werte je Zeitraum, sonst null.
 */
export function stressVsNormal(entries: StressEntry[], date: IsoDate, minValues = 3): number | null {
  const recentFrom = addDays(date, -6);
  const normalFrom = addDays(date, -27);
  const normalTo = addDays(date, -7);
  const recent = entries.filter((e) => e.date >= recentFrom && e.date <= date).map((e) => e.stress);
  const normal = entries.filter((e) => e.date >= normalFrom && e.date <= normalTo).map((e) => e.stress);
  if (recent.length < minValues || normal.length < minValues) return null;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.round((mean(recent) / mean(normal) - 1) * 100);
}
