import type { DailyMetrics, WeekHint } from "@/core/load";

/**
 * Höchstens ein Tipp pro Tag (docs/AENDERUNGEN.md › Heute). Reihenfolge nach Wichtigkeit:
 * Schmerz-Rot vor Ampel vor fehlendem Feedback vor Wochenhinweisen vor Trends.
 */
export type Tip =
  | { code: "pain_red" }
  | { code: "light_red" }
  | { code: "feedback_open"; count: number }
  | { code: "week_hint"; hint: WeekHint }
  | { code: "stress_high"; percent: number }
  | { code: "load_high"; percent: number }
  | { code: "underload" }
  | { code: "test_due"; days: number };

export interface TipInput {
  metrics: DailyMetrics;
  openFeedback: number;
  weekHints: WeekHint[];
  /** Tage bis zum nächsten Referenztest (null = keiner geplant). */
  testDueInDays: number | null;
}

/** Ab dieser Abweichung vom Normalwert wird ein Trend erwähnt. */
const TREND_THRESHOLD_PCT = 20;

export function pickTip({ metrics, openFeedback, weekHints, testDueInDays }: TipInput): Tip | null {
  if (metrics.painSpots.some((s) => s.level === "red")) return { code: "pain_red" };
  if (metrics.light === "red") return { code: "light_red" };
  if (openFeedback > 0) return { code: "feedback_open", count: openFeedback };
  if (testDueInDays != null && testDueInDays <= 0) return { code: "test_due", days: testDueInDays };
  if (weekHints.length > 0) return { code: "week_hint", hint: weekHints[0] };
  if (metrics.stressDelta != null && metrics.stressDelta >= TREND_THRESHOLD_PCT) {
    return { code: "stress_high", percent: metrics.stressDelta };
  }
  if (metrics.loadDelta != null && metrics.loadDelta >= TREND_THRESHOLD_PCT) {
    return { code: "load_high", percent: metrics.loadDelta };
  }
  if (metrics.underload) return { code: "underload" };
  return null;
}
