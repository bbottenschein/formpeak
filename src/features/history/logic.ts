import { addDays, dateRange, mondayOf, type BodyRegion, type BodySide, type IsoDate } from "@/core/load";
import { best1rm, volume, type GymSet } from "@/features/gym/logic";

/* ---------------------------------------------------------------- Schmerz */

export interface PainRecord {
  date: IsoDate;
  region: BodyRegion;
  side: BodySide;
  intensity: number;
}

export interface PainHistoryRow {
  region: BodyRegion;
  side: BodySide;
  /** Höchste Stärke pro Tag im Zeitraum (0 = kein Eintrag). */
  days: { date: IsoDate; intensity: number }[];
  daysWithPain: number;
  maxIntensity: number;
  lastDate: IsoDate;
}

/** Schmerzhistorie je Stelle im Zeitraum, zuletzt betroffene Stellen zuerst. */
export function painHistory(records: PainRecord[], from: IsoDate, to: IsoDate): PainHistoryRow[] {
  const bySpot = new Map<string, Map<IsoDate, number>>();
  for (const r of records) {
    if (r.date < from || r.date > to || r.intensity < 1) continue;
    const key = `${r.region}|${r.side}`;
    const days = bySpot.get(key) ?? new Map<IsoDate, number>();
    days.set(r.date, Math.max(days.get(r.date) ?? 0, r.intensity));
    bySpot.set(key, days);
  }
  const range = dateRange(from, to);
  return [...bySpot.entries()]
    .map(([key, days]) => {
      const [region, side] = key.split("|") as [BodyRegion, BodySide];
      const dates = [...days.keys()].sort();
      return {
        region,
        side,
        days: range.map((date) => ({ date, intensity: days.get(date) ?? 0 })),
        daysWithPain: days.size,
        maxIntensity: Math.max(...days.values()),
        lastDate: dates[dates.length - 1],
      };
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.maxIntensity - a.maxIntensity);
}

/* ---------------------------------------------------------------- Gym */

export interface LoggedSet extends GymSet {
  date: IsoDate;
  exerciseId: string;
  muscleGroup: string;
}

export interface E1rmPoint {
  date: IsoDate;
  e1rm: number;
}

/** Geschätztes 1RM je Einheit für eine Übung (bestes Ergebnis des Tages), chronologisch. */
export function e1rmSeries(sets: LoggedSet[], exerciseId: string): E1rmPoint[] {
  const byDate = new Map<IsoDate, GymSet[]>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId) continue;
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  }
  return [...byDate.entries()]
    .map(([date, daySets]) => ({ date, e1rm: best1rm(daySets) }))
    .filter((p) => p.e1rm > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface WeeklyVolume {
  /** Montag der Woche. */
  week: IsoDate;
  /** Volumen (kg × Wdh, Arbeitssätze) je Muskelgruppe. */
  byGroup: Record<string, number>;
}

/** Volumen je Muskelgruppe für die letzten `weeks` Wochen bis einschließlich der Woche von `today`. */
export function weeklyVolume(sets: LoggedSet[], today: IsoDate, weeks: number): WeeklyVolume[] {
  const lastMonday = mondayOf(today);
  const mondays = Array.from({ length: weeks }, (_, i) => addDays(lastMonday, -7 * (weeks - 1 - i)));
  return mondays.map((week) => {
    const byGroup: Record<string, number> = {};
    for (const s of sets) {
      if (mondayOf(s.date) !== week) continue;
      byGroup[s.muscleGroup] = (byGroup[s.muscleGroup] ?? 0) + volume([s]);
    }
    return { week, byGroup };
  });
}
