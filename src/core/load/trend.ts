import { LOAD_CONFIG, type LoadConfig } from "./config";
import { computeDailyMetrics, type DailyInput } from "./daily";
import { dateRange, type IsoDate } from "./dates";
import type { TrafficLight } from "./types";

export interface TrendPoint {
  date: IsoDate;
  /** null = an dem Tag kein Morgen-Check-in. */
  readiness: number | null;
  /** Performance-Score (Erholung minus Belastungskorrektur), null ohne Check-in. */
  score: number | null;
  /** Ampel des Tages (grau ohne Check-in). */
  light: TrafficLight;
  /** Tatsächliche Tageslast in AU. */
  load: number;
  acwr: number | null;
}

/** Verlauf von Readiness, Ampel und Last für einen Zeitraum (beide Grenzen inklusive). */
export function computeTrend(
  from: IsoDate,
  to: IsoDate,
  input: DailyInput,
  config: LoadConfig = LOAD_CONFIG,
): TrendPoint[] {
  return dateRange(from, to).map((date) => {
    const m = computeDailyMetrics(date, input, config);
    return {
      date,
      readiness: m.readiness,
      score: m.performance?.score ?? null,
      light: m.light,
      load: m.dayLoad,
      acwr: m.acwr,
    };
  });
}
