/**
 * Datum in der Zeitzone des Nutzers. Jeder Nutzer hat eine eigene Zeitzone
 * (`profiles.timezone`); alle Tagesgrenzen werden hier gebildet.
 * Reine Kalenderrechnung (addDays usw.) liegt in `src/core/load/dates.ts`.
 */
export { addDays, diffDays, mondayOf, weekdayOf, dateRange, type IsoDate } from "@/core/load/dates";

export const DEFAULT_TIME_ZONE = "Europe/Berlin";

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Prüft, ob eine IANA-Zeitzone gültig ist. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Datum (YYYY-MM-DD) und Uhrzeit (HH:mm) eines Zeitpunkts in einer Zeitzone. */
export function zonedParts(at: Date, timeZone: string): { date: string; time: string; hour: number } {
  const p = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, hour: Number(p.hour) };
}

/** Heutiges Datum des Nutzers. Nie `new Date().toISOString().slice(0, 10)` verwenden. */
export function userToday(timeZone: string, at: Date = new Date()): string {
  return zonedParts(at, timeZone).date;
}

/** Versatz der Zeitzone gegenüber UTC in Minuten zu einem Zeitpunkt. */
function offsetMinutes(at: Date, timeZone: string): number {
  const { date, time } = zonedParts(at, timeZone);
  const asUtc = Date.parse(`${date}T${time}:00Z`);
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** Zeitpunkt (UTC) für ein lokales Datum und eine lokale Uhrzeit in der Zeitzone. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const guess = Date.parse(`${date}T${time.slice(0, 5)}:00Z`);
  let utc = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  // Um die Zeitumstellung herum den Versatz am Ergebnis noch einmal prüfen.
  const corrected = guess - offsetMinutes(new Date(utc), timeZone) * 60000;
  if (corrected !== utc) utc = corrected;
  return new Date(utc);
}

/** Datum für die Anzeige, z. B. „Donnerstag, 26. November“. */
export function formatLongDate(date: string, locale = "de-DE"): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
