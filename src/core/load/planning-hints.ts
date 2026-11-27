import { LOAD_CONFIG, type LoadConfig } from "./config";
import { addDays, dateRange, mondayOf, type IsoDate } from "./dates";
import { matchdayContext } from "./matchday";
import type { PainSpotStatus } from "./pain";
import type { Session, TrafficLight } from "./types";
import { weeklyLoad } from "./weekly-load";

/**
 * Hinweise für selbst geplante Einheiten in Phase 1 (SPEC 4.6 / 4.7).
 * Die App ändert den Plan nicht selbst – sie zeigt nur Hinweise. Texte kommen über i18n,
 * deshalb liefern die Funktionen Codes mit Parametern.
 */
export type SessionHint =
  | { code: "light_red_only_recovery" }
  | { code: "light_yellow_reduce"; percent: number }
  | { code: "matchday_no_extra" }
  | { code: "md_plus_1_recovery" }
  | { code: "md_minus_1_short" }
  | { code: "lower_body_too_soon_after_match"; daysSinceMatch: number }
  | { code: "lower_body_too_close_to_match"; daysToMatch: number }
  | { code: "intervals_next_to_intense_training" }
  | { code: "pain_spare_region"; spots: PainSpotStatus[] };

export type WeekHint =
  | { code: "no_rest_day" }
  | { code: "weekly_load_increase"; percent: number };

const LIGHT_TYPES = new Set(["mobility", "recovery"]);

/** Einheit gilt als intensiv, wenn ihr (Ziel-)RPE die Schwelle erreicht. */
export function isIntense(s: Session, config: LoadConfig = LOAD_CONFIG): boolean {
  const rpe = s.status === "done" && s.rpe != null ? s.rpe : (s.targetRpe ?? s.defaultRpe);
  return rpe >= config.planning.intenseRpe;
}

export interface SessionHintContext {
  /** Alle Einheiten rund um den Tag (mindestens ±1 Tag), inkl. Fußballtermine. */
  sessions: Session[];
  /** Ampel – nur für den heutigen Tag bekannt. */
  light?: TrafficLight;
  painSpots?: PainSpotStatus[];
}

/** Hinweise zu einer selbst geplanten Zusatzeinheit. Fußballtermine bekommen keine Hinweise. */
export function sessionHints(
  session: Session,
  ctx: SessionHintContext,
  config: LoadConfig = LOAD_CONFIG,
): SessionHint[] {
  if (session.isFixture || session.status === "cancelled") return [];

  const hints: SessionHint[] = [];
  const light = LIGHT_TYPES.has(session.type);
  const intense = isIntense(session, config);
  const matchDates = ctx.sessions
    .filter((s) => s.type === "match" && s.status !== "cancelled")
    .map((s) => s.date);
  const md = matchdayContext(session.date, matchDates);
  const p = config.planning;

  // Ampel
  if (ctx.light === "red" && !light) hints.push({ code: "light_red_only_recovery" });
  if (ctx.light === "yellow" && !light) {
    hints.push({ code: "light_yellow_reduce", percent: Math.round(p.yellowReduction * 100) });
  }

  // Spieltagslogik
  if (md.daysToNext === 0 && !light) hints.push({ code: "matchday_no_extra" });
  if (md.daysSinceLast === 1 && !light) hints.push({ code: "md_plus_1_recovery" });
  if (md.daysToNext === 1 && !light && (intense || session.durationMin > 30)) {
    hints.push({ code: "md_minus_1_short" });
  }

  // Unterkörperkraft: frühestens MD+2, spätestens MD−3
  if (session.type === "gym" && (session.gymFocus === "lower" || session.gymFocus === "full")) {
    if (md.daysSinceLast != null && md.daysSinceLast < p.lowerBodyEarliestAfterMatch) {
      hints.push({ code: "lower_body_too_soon_after_match", daysSinceMatch: md.daysSinceLast });
    }
    if (md.daysToNext != null && md.daysToNext < p.lowerBodyLatestBeforeMatch) {
      hints.push({ code: "lower_body_too_close_to_match", daysToMatch: md.daysToNext });
    }
  }

  // Harte Intervalle nicht direkt vor/nach (oder am Tag von) intensivem Teamtraining
  if (session.type === "run_intervals" && intense) {
    const near = new Set([addDays(session.date, -1), session.date, addDays(session.date, 1)]);
    const intenseTraining = ctx.sessions.some(
      (s) =>
        s.type === "training" &&
        s.status !== "cancelled" &&
        s.expectedIntensity === "high" &&
        near.has(s.date),
    );
    if (intenseTraining) hints.push({ code: "intervals_next_to_intense_training" });
  }

  // Schmerz-Sperren
  const spare = (ctx.painSpots ?? []).filter((s) => s.level !== "note");
  if (spare.length > 0 && !light) hints.push({ code: "pain_spare_region", spots: spare });

  return hints;
}

/**
 * Hinweise zur Woche (Mo–So), in der `date` liegt.
 * Wochenlast wie beim Wochenplan (`weeklyLoad`): ohne leichte Zusatzeinheiten, Vergleich mit der Vorwoche.
 */
export function weekHints(
  date: IsoDate,
  sessions: Session[],
  today: IsoDate,
  config: LoadConfig = LOAD_CONFIG,
): WeekHint[] {
  const hints: WeekHint[] = [];
  const monday = mondayOf(date);
  const week = dateRange(monday, addDays(monday, 6));
  const active = sessions.filter((s) => s.status !== "cancelled");

  const busyDays = new Set(active.map((s) => s.date));
  if (week.every((d) => busyDays.has(d))) hints.push({ code: "no_rest_day" });

  const { planned, reference } = weeklyLoad(monday, sessions, today, config);
  if (reference > 0) {
    const increase = planned / reference - 1;
    if (increase > config.planning.maxWeeklyIncrease + 1e-9) {
      hints.push({ code: "weekly_load_increase", percent: Math.round(increase * 100) });
    }
  }
  return hints;
}

/** Hinweis auf Unterlast (ACWR < 0,8) – keine Ampeländerung. */
export function isUnderloaded(acwr: number | null, config: LoadConfig = LOAD_CONFIG): boolean {
  return acwr != null && acwr < config.acwr.underload;
}
