import { LOAD_CONFIG, type LoadConfig } from "./config";
import { addDays, type IsoDate } from "./dates";
import { expectedLoad, plannedLoad } from "./session-load";
import type { Session } from "./types";

/**
 * Leichte Zusatzeinheit (Mobilität/Regeneration bis RPE 4). Sie dient der Erholung und zählt
 * nicht zur 15-%-Regel der Wochenlast.
 */
export function isLightExtra(s: Session, config: LoadConfig = LOAD_CONFIG): boolean {
  const rpe = s.status === "done" && s.rpe != null ? s.rpe : (s.targetRpe ?? s.defaultRpe);
  return !s.isFixture && (s.type === "mobility" || s.type === "recovery") && rpe <= config.guardrails.extraMaxRpe;
}

/**
 * Wochenlast für die 15-%-Regel (SPEC 4.6): geplante Last der Woche ab `monday` (ohne leichte
 * Zusatzeinheiten) und Vergleichswert = Vorwoche bzw. Wochenschnitt der letzten vier Wochen,
 * falls dieser höher ist. Kommende Termine der Vorwoche zählen mit ihrer geplanten Last.
 */
export function weeklyLoad(
  monday: IsoDate,
  sessions: Session[],
  today: IsoDate,
  config: LoadConfig = LOAD_CONFIG,
): { planned: number; reference: number } {
  const sunday = addDays(monday, 6);
  const counted = sessions.filter((s) => s.status !== "cancelled" && !isLightExtra(s, config));
  const before = (from: IsoDate) =>
    counted.filter((s) => s.date >= from && s.date < monday).reduce((sum, s) => sum + expectedLoad(s, today), 0);
  return {
    planned: counted.filter((s) => s.date >= monday && s.date <= sunday).reduce((sum, s) => sum + plannedLoad(s), 0),
    reference: Math.max(before(addDays(monday, -7)), before(addDays(monday, -28)) / 4),
  };
}
