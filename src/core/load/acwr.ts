import { LOAD_CONFIG, type LoadConfig } from "./config";
import { addDays, dateRange, diffDays, type IsoDate } from "./dates";

export interface AcwrResult {
  /** Summe der letzten 7 Tage (inkl. heute). */
  acute: number;
  /** Wochenschnitt der 3 Wochen vor der akuten Woche. */
  chronic: number;
  /** ACWR auf 2 Nachkommastellen, null solange nicht aussagekräftig. */
  ratio: number | null;
  /** Tage bis zum Ende der Kalibrierung (0 = fertig). */
  calibrationDaysLeft: number;
  /** EWMA-Verhältnis zum Vergleich (wird nur geloggt), null ohne chronische Last. */
  ewmaRatio: number | null;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function sum(loads: Map<IsoDate, number>, from: IsoDate, to: IsoDate): number {
  let total = 0;
  for (const d of dateRange(from, to)) total += loads.get(d) ?? 0;
  return total;
}

/**
 * ACWR „uncoupled“ für Tag `date` (SPEC 4.2).
 * `firstDataDate` = erster Tag, ab dem die App Daten hat (Start der Kalibrierung).
 */
export function computeAcwr(
  loads: Map<IsoDate, number>,
  date: IsoDate,
  firstDataDate: IsoDate | null,
  config: LoadConfig = LOAD_CONFIG,
): AcwrResult {
  const { acuteDays, chronicDays } = config.acwr;
  const chronicWeeks = (chronicDays - acuteDays) / 7;

  const acute = sum(loads, addDays(date, -(acuteDays - 1)), date);
  const chronic =
    sum(loads, addDays(date, -(chronicDays - 1)), addDays(date, -acuteDays)) / chronicWeeks;

  const daysOfData = firstDataDate == null ? 0 : diffDays(firstDataDate, date) + 1;
  const calibrationDaysLeft = Math.max(0, chronicDays - daysOfData);

  const ratio = calibrationDaysLeft === 0 && chronic > 0 ? round2(acute / chronic) : null;
  const ewmaRatio = firstDataDate == null ? null : computeEwmaRatio(loads, firstDataDate, date, config);

  return { acute, chronic: round2(chronic), ratio, calibrationDaysLeft, ewmaRatio };
}

/** EWMA-Verhältnis (Williams et al.), Start mit der Last des ersten Tages. */
export function computeEwmaRatio(
  loads: Map<IsoDate, number>,
  from: IsoDate,
  to: IsoDate,
  config: LoadConfig = LOAD_CONFIG,
): number | null {
  if (from > to) return null;
  const la = 2 / (config.acwr.ewmaAcuteDays + 1);
  const lc = 2 / (config.acwr.ewmaChronicDays + 1);
  let acute = loads.get(from) ?? 0;
  let chronic = acute;
  for (const d of dateRange(addDays(from, 1), to)) {
    const load = loads.get(d) ?? 0;
    acute = la * load + (1 - la) * acute;
    chronic = lc * load + (1 - lc) * chronic;
  }
  return chronic > 0 ? round2(acute / chronic) : null;
}
