import { diffDays, type IsoDate } from "./dates";

export interface MatchdayContext {
  /** Tage bis zum nächsten Spiel (0 = Spieltag), null ohne kommendes Spiel. */
  daysToNext: number | null;
  /** Tage seit dem letzten Spiel (0 = Spieltag), null ohne vergangenes Spiel. */
  daysSinceLast: number | null;
}

/**
 * Lage eines Tages relativ zu den Spielen (MD−n / MD+n).
 * `matchDates`: Daten aller nicht abgesagten Spiele.
 */
export function matchdayContext(date: IsoDate, matchDates: IsoDate[]): MatchdayContext {
  let daysToNext: number | null = null;
  let daysSinceLast: number | null = null;
  for (const m of matchDates) {
    const diff = diffDays(date, m);
    if (diff >= 0 && (daysToNext == null || diff < daysToNext)) daysToNext = diff;
    if (diff <= 0 && (daysSinceLast == null || Math.abs(diff) < daysSinceLast)) {
      daysSinceLast = Math.abs(diff);
    }
  }
  return { daysToNext, daysSinceLast };
}

/** Kurzlabel für die Wochenansicht, z. B. „MD“, „MD−1“, „MD+2“. Nächstes Spiel hat Vorrang. */
export function matchdayLabel(ctx: MatchdayContext, maxDistance = 4): string | null {
  if (ctx.daysToNext === 0) return "MD";
  const before = ctx.daysToNext;
  const after = ctx.daysSinceLast;
  if (before != null && before <= maxDistance && (after == null || before <= after)) {
    return `MD−${before}`;
  }
  if (after != null && after <= maxDistance) return `MD+${after}`;
  return null;
}
