import { LOAD_CONFIG, type LoadConfig } from "./config";
import type { MorningCheckin } from "./types";

export type ReadinessFactor = keyof LoadConfig["readiness"]["weights"];

export interface ReadinessResult {
  /** 0–100, gerundet. */
  score: number;
  /** Normierte Teilwerte 0–100 (null = nicht verfügbar). */
  factors: Record<ReadinessFactor, number | null>;
  /** Ruhepuls-Basis (Mittel der letzten Messungen), null ohne genug Messungen. */
  restingHrBaseline: number | null;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 1–5 → 0–100, 5 = gut. */
const scale = (v: number) => clamp01((v - 1) / 4) * 100;
/** 1–5 → 0–100, 1 = gut (Muskelkater, Stress). */
const scaleInverse = (v: number) => clamp01((5 - v) / 4) * 100;

/** Teilwert Schlafdauer: ≤ 5 h = 0, ≥ 8 h = 100, linear dazwischen. */
export function sleepDurationScore(hours: number, config: LoadConfig = LOAD_CONFIG): number {
  const { sleepZeroHours, sleepFullHours } = config.readiness;
  return clamp01((hours - sleepZeroHours) / (sleepFullHours - sleepZeroHours)) * 100;
}

/** Teilwert Ruhepuls: erst ab +8 Abweichung Abzug, ab +20 null Punkte. Niedriger ist kein Abzug. */
export function restingHrScore(
  restingHr: number,
  baseline: number,
  config: LoadConfig = LOAD_CONFIG,
): number {
  const { toleranceBpm, zeroAtBpm } = config.readiness.restingHr;
  const delta = restingHr - baseline;
  if (delta < toleranceBpm) return 100;
  if (delta >= zeroAtBpm) return 0;
  return ((zeroAtBpm - delta) / (zeroAtBpm - toleranceBpm)) * 100;
}

/** Basis = Mittel der letzten 7 Messungen vor heute, erst ab 3 Messungen. */
export function restingHrBaseline(
  previous: number[],
  config: LoadConfig = LOAD_CONFIG,
): number | null {
  const { baselineSize, minMeasurements } = config.readiness.restingHr;
  const recent = previous.slice(-baselineSize);
  if (recent.length < minMeasurements) return null;
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

/**
 * Readiness-Score aus dem Morgen-Check-in (SPEC 4.3).
 * `previousRestingHr`: frühere Ruhepuls-Messungen, chronologisch, ohne heute.
 * Fehlt der Ruhepuls oder die Basis, werden die übrigen Gewichte anteilig hochskaliert.
 */
export function computeReadiness(
  checkin: MorningCheckin,
  previousRestingHr: number[],
  config: LoadConfig = LOAD_CONFIG,
): ReadinessResult {
  const baseline = restingHrBaseline(previousRestingHr, config);
  const factors: Record<ReadinessFactor, number | null> = {
    sleepDuration: sleepDurationScore(checkin.sleepHours, config),
    sleepQuality: scale(checkin.sleepQuality),
    energy: scale(checkin.energy),
    soreness: scaleInverse(checkin.soreness),
    stress: scaleInverse(checkin.stress),
    restingHr:
      checkin.restingHr != null && baseline != null
        ? restingHrScore(checkin.restingHr, baseline, config)
        : null,
  };

  let weighted = 0;
  let totalWeight = 0;
  for (const key of Object.keys(factors) as ReadinessFactor[]) {
    const value = factors[key];
    if (value == null) continue;
    const weight = config.readiness.weights[key];
    weighted += value * weight;
    totalWeight += weight;
  }

  return {
    score: Math.round(weighted / totalWeight),
    factors,
    restingHrBaseline: baseline,
  };
}

/** Ruhepuls aus der 10-Sekunden-Zählung. */
export function restingHrFromCount(countIn10s: number): number {
  return countIn10s * 6;
}
