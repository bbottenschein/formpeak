/**
 * Reine Helfer für Kalenderdaten im Format YYYY-MM-DD (ohne Zeitzone).
 * Welcher Tag „heute“ ist, entscheidet die App-Schicht über die Zeitzone des Nutzers.
 */
export type IsoDate = string;

const DAY_MS = 86_400_000;

function toUtc(date: IsoDate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Verschiebt ein Datum um n Tage. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Tage von `from` bis `to` (positiv, wenn `to` später liegt). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Wochentag: 0 = Sonntag … 6 = Samstag. */
export function weekdayOf(date: IsoDate): number {
  return new Date(toUtc(date)).getUTCDay();
}

/** Montag der Woche, in der das Datum liegt (Wochen laufen Mo–So). */
export function mondayOf(date: IsoDate): IsoDate {
  const offset = (weekdayOf(date) + 6) % 7;
  return addDays(date, -offset);
}

/** Alle Daten von `from` bis `to` (jeweils inklusive). */
export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
