import { dateRange, weekdayOf, type ExpectedIntensity, type IsoDate, type SessionType } from "@/core/load";

/** Serie fester Fußballtermine, z. B. Training Di + Do, Spiel Sa. */
export interface FixtureSeries {
  id: string;
  kind: "training" | "match";
  weekdays: number[];
  startTime: string | null;
  durationMin: number;
  expectedIntensity: ExpectedIntensity;
  defaultRpe: number;
  validFrom: IsoDate;
  validUntil: IsoDate | null;
}

/** Standard-RPE für selbst geplante Einheiten, wenn kein Ziel-RPE gesetzt ist. */
export const DEFAULT_RPE: Record<SessionType, number> = {
  training: 6,
  match: 8,
  gym: 6,
  run_intervals: 7,
  mobility: 2,
  recovery: 2,
};

/** Erwartete Intensität → Standard-RPE für neue Trainingsserien. */
export const RPE_FOR_INTENSITY: Record<ExpectedIntensity, number> = { low: 4, medium: 6, high: 8 };

/** Alle Termine einer Serie im Zeitraum (beide Grenzen inklusive). */
export function seriesDates(series: FixtureSeries, from: IsoDate, to: IsoDate): IsoDate[] {
  const start = series.validFrom > from ? series.validFrom : from;
  const end = series.validUntil && series.validUntil < to ? series.validUntil : to;
  return dateRange(start, end).filter((d) => series.weekdays.includes(weekdayOf(d)));
}

export interface FixtureRow {
  series_id: string;
  series_date: IsoDate;
  date: IsoDate;
  start_time: string | null;
  type: "training" | "match";
  status: "planned";
  is_fixture: true;
  duration_min: number;
  default_rpe: number;
  expected_intensity: ExpectedIntensity;
  planned_by: "user";
}

/**
 * Termine, die für die Serien im Zeitraum noch als Einheit fehlen.
 * `existing`: Schlüssel `seriesId|seriesDate` aller schon angelegten Einheiten (auch verschobene
 * und abgesagte), damit nichts doppelt entsteht.
 */
export function missingFixtures(
  series: FixtureSeries[],
  existing: Set<string>,
  from: IsoDate,
  to: IsoDate,
): FixtureRow[] {
  const rows: FixtureRow[] = [];
  for (const s of series) {
    for (const d of seriesDates(s, from, to)) {
      if (existing.has(`${s.id}|${d}`)) continue;
      rows.push({
        series_id: s.id,
        series_date: d,
        date: d,
        start_time: s.startTime,
        type: s.kind,
        status: "planned",
        is_fixture: true,
        duration_min: s.durationMin,
        default_rpe: s.defaultRpe,
        expected_intensity: s.expectedIntensity,
        planned_by: "user",
      });
    }
  }
  return rows;
}
