import { addDays, sessionLoad, type IsoDate, type Session } from "@/core/load";

/**
 * Dranbleiben und Rückblick – reine Logik (getestet in logic.test.ts).
 */

/** Tage in Folge mit Morgen-Check-in bis heute (heute noch offen → Serie bis gestern zählt). */
export function checkinStreak(dates: IsoDate[], today: IsoDate): number {
  const set = new Set(dates);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export interface PlanOutcome {
  date: IsoDate;
  status: "planned" | "done" | "cancelled";
  /** Vorschlag der App (ai/rules) – nur diese zählen für „erledigt“. */
  suggested: boolean;
  /** Von der täglichen Anpassung gestrichen – zählt nicht gegen den Nutzer. */
  adjusted: boolean;
}

/**
 * Anteil erledigter Vorschläge im Zeitraum [from, to) bis gestern: erledigt / (erledigt + offen
 * gebliebene + selbst gestrichene). Von der App gestrichene zählen nicht. Null ohne Vorschläge.
 */
export function completionRate(items: PlanOutcome[], from: IsoDate, to: IsoDate, today: IsoDate): number | null {
  const relevant = items.filter((i) => i.suggested && i.date >= from && i.date < to && i.date < today && !(i.status === "cancelled" && i.adjusted));
  if (relevant.length === 0) return null;
  return Math.round((relevant.filter((i) => i.status === "done").length / relevant.length) * 100);
}

export interface ReviewStats {
  /** Erledigte und insgesamt geplante Einheiten (ohne von der App gestrichene). */
  done: number;
  planned: number;
  /** Tatsächliche Last (AU) im Zeitraum und im gleich langen Zeitraum davor. */
  load: number;
  prevLoad: number;
  /** Veränderung der Last in Prozent (null ohne Vorperiode). */
  loadDelta: number | null;
  checkins: number;
  days: number;
}

/** Kennzahlen eines Zeitraums [from, to) (Woche oder Monat). */
export function reviewStats(
  sessions: (Session & { adjusted?: boolean })[],
  checkinDates: IsoDate[],
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
): ReviewStats {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  const prevFrom = addDays(from, -days);
  const inRange = (s: { date: IsoDate }, a: IsoDate, b: IsoDate) => s.date >= a && s.date < b;
  const counted = sessions.filter((s) => inRange(s, from, to) && !(s.status === "cancelled" && s.adjusted) && s.status !== "cancelled");
  const load = (a: IsoDate, b: IsoDate) =>
    sessions.filter((s) => inRange(s, a, b)).reduce((sum, s) => sum + sessionLoad(s, today).load, 0);
  const cur = load(from, to);
  const prev = load(prevFrom, from);
  return {
    // Vergangene Fußballtermine ohne Feedback gelten als absolviert (wie bei der Last).
    done: counted.filter((s) => s.status === "done" || (s.isFixture && s.date < today)).length,
    planned: counted.length,
    load: cur,
    prevLoad: prev,
    loadDelta: prev > 0 ? Math.round((cur / prev - 1) * 100) : null,
    checkins: checkinDates.filter((d) => d >= from && d < to).length,
    days,
  };
}

export type ReviewHint = "few_done" | "load_spike" | "load_drop" | "few_checkins" | "steady";

/** Ein Hinweis für die nächste Woche ohne KI – der wichtigste zuerst. */
export function reviewHint(s: ReviewStats): ReviewHint {
  if (s.loadDelta != null && s.loadDelta > 25) return "load_spike";
  if (s.planned > 0 && s.done / s.planned < 0.6) return "few_done";
  if (s.checkins < Math.ceil(s.days * 0.6)) return "few_checkins";
  if (s.loadDelta != null && s.loadDelta < -40) return "load_drop";
  return "steady";
}
