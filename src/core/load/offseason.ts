import { LOAD_CONFIG, type LoadConfig } from "./config";
import { addDays, diffDays, mondayOf, type IsoDate } from "./dates";

/**
 * Off-Season (Winter-/Sommerpause ohne Teamtraining und Spiele), gegliedert in drei Abschnitte:
 * Erholen (frei wählbar 0–2 Wochen) → Aufbauen (Entlastungswoche alle 4 Wochen) →
 * Zurück zum Fußball (letzte Wochen vor der Vorbereitung, nur wenn deren Start bekannt ist).
 * Wochen laufen Mo–So; Woche 1 ist die Woche, in der die Pause beginnt.
 */

export type OffseasonBlock = "recover" | "build" | "return";

export interface OffseasonPhase {
  startsOn: IsoDate;
  /** Letzter Tag der Pause (Tag vor der Vorbereitung); null = noch offen. */
  endsOn: IsoDate | null;
  recoveryWeeks: number;
}

export interface OffseasonWeek {
  week: number;
  /** Anzahl Wochen der Pause; null, solange das Ende offen ist. */
  totalWeeks: number | null;
  block: OffseasonBlock;
  /** Entlastungswoche (Umfang runter) im Aufbau. */
  deload: boolean;
  /** Ganze Wochen bis zum Start der Vorbereitung (ab dem Montag dieser Woche). */
  weeksToPreseason: number | null;
}

/** Ob ein Datum in der Pause liegt. */
export function inOffseason(phase: OffseasonPhase, date: IsoDate): boolean {
  return date >= phase.startsOn && (phase.endsOn == null || date <= phase.endsOn);
}

/** Wie viele Wochen vor der Vorbereitung „Zurück zum Fußball“ dauert. */
export function returnWeeks(totalWeeks: number | null, recoveryWeeks: number, config: LoadConfig = LOAD_CONFIG): number {
  if (totalWeeks == null) return 0;
  const left = totalWeeks - recoveryWeeks;
  return config.offseason.returnWeeks.find((r) => left >= r.minWeeks)?.weeks ?? 0;
}

export function offseasonWeek(phase: OffseasonPhase, date: IsoDate, config: LoadConfig = LOAD_CONFIG): OffseasonWeek {
  const first = mondayOf(phase.startsOn);
  const week = Math.floor(diffDays(first, mondayOf(date)) / 7) + 1;
  const totalWeeks = phase.endsOn ? Math.floor(diffDays(first, mondayOf(phase.endsOn)) / 7) + 1 : null;
  const ret = returnWeeks(totalWeeks, phase.recoveryWeeks, config);

  let block: OffseasonBlock = "build";
  if (week <= phase.recoveryWeeks) block = "recover";
  else if (totalWeeks != null && week > totalWeeks - ret) block = "return";

  const buildIndex = week - phase.recoveryWeeks;
  const deload = block === "build" && buildIndex > 0 && buildIndex % config.offseason.deloadEvery === 0;
  const weeksToPreseason = phase.endsOn
    ? Math.max(0, Math.ceil(diffDays(mondayOf(date), addDays(phase.endsOn, 1)) / 7))
    : null;
  return { week, totalWeeks, block, deload, weeksToPreseason };
}
