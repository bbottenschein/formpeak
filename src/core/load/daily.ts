import { LOAD_CONFIG, type LoadConfig } from "./config";
import type { IsoDate } from "./dates";
import { computeAcwr } from "./acwr";
import { activePainSpots, type PainSpotStatus } from "./pain";
import { isUnderloaded } from "./planning-hints";
import { computeReadiness } from "./readiness";
import { computePerformanceScore, loadVsNormal, stressVsNormal, type PerformanceScore, type StressEntry } from "./score";
import { dailyLoads } from "./session-load";
import { computeTrafficLight, type LightReason } from "./traffic-light";
import type { MorningCheckin, PainEntry, Session, TrafficLight } from "./types";

export interface DailyInput {
  sessions: Session[];
  morningCheckins: MorningCheckin[];
  painEntries: PainEntry[];
  /** Erster Tag mit Daten (Start der Kalibrierung). */
  firstDataDate: IsoDate | null;
  /** Heutiges Datum in der Zeitzone des Nutzers. */
  today: IsoDate;
  /** Stresswerte aus den Abend-Check-ins (optional, für den Vergleich mit dem Normalwert). */
  eveningStress?: StressEntry[];
}

export interface DailyMetrics {
  date: IsoDate;
  dayLoad: number;
  acute: number;
  chronic: number;
  acwr: number | null;
  ewmaRatio: number | null;
  calibrationDaysLeft: number;
  underload: boolean;
  readiness: number | null;
  /** Performance-Score mit Aufschlüsselung, null ohne Morgen-Check-in. */
  performance: PerformanceScore | null;
  /** Belastung 7 Tage vs. Normalwert in %, null ohne Normalwert. */
  loadDelta: number | null;
  /** Stress 7 Tage vs. Normalwert in %, null ohne genug Werte. */
  stressDelta: number | null;
  light: TrafficLight;
  reasons: LightReason[];
  painSpots: PainSpotStatus[];
}

/** Alle Kennzahlen eines Tages – Grundlage für `daily_metrics` und den Heute-Screen. */
export function computeDailyMetrics(
  date: IsoDate,
  input: DailyInput,
  config: LoadConfig = LOAD_CONFIG,
): DailyMetrics {
  const loads = dailyLoads(input.sessions, input.today);
  const acwr = computeAcwr(loads, date, input.firstDataDate, config);

  const sorted = [...input.morningCheckins].sort((a, b) => a.date.localeCompare(b.date));
  const checkin = sorted.find((c) => c.date === date) ?? null;
  const previousHr = sorted
    .filter((c) => c.date < date && c.restingHr != null)
    .map((c) => c.restingHr as number);
  const readinessResult = checkin ? computeReadiness(checkin, previousHr, config) : null;
  const readiness = readinessResult?.score ?? null;

  const painSpots = activePainSpots(
    input.painEntries,
    new Set(sorted.map((c) => c.date)),
    date,
    config,
  );
  const { light, reasons } = computeTrafficLight(
    { readiness, acwr: acwr.ratio, painSpots },
    config,
  );

  return {
    date,
    dayLoad: loads.get(date) ?? 0,
    acute: acwr.acute,
    chronic: acwr.chronic,
    acwr: acwr.ratio,
    ewmaRatio: acwr.ewmaRatio,
    calibrationDaysLeft: acwr.calibrationDaysLeft,
    underload: isUnderloaded(acwr.ratio, config),
    readiness,
    performance: readinessResult ? computePerformanceScore(readinessResult, acwr.ratio, config) : null,
    loadDelta: loadVsNormal(acwr.ratio),
    stressDelta: stressVsNormal(
      [...sorted.map((c) => ({ date: c.date, stress: c.stress })), ...(input.eveningStress ?? [])],
      date,
    ),
    light,
    reasons,
    painSpots,
  };
}
