import { describe, expect, it } from "vitest";
import type { DailyMetrics, PainSpotStatus } from "@/core/load";
import { pickTip } from "./tip";

const metrics = (extra: Partial<DailyMetrics> = {}): DailyMetrics => ({
  date: "2026-11-27",
  dayLoad: 0,
  acute: 0,
  chronic: 0,
  acwr: 1,
  ewmaRatio: 1,
  calibrationDaysLeft: 0,
  underload: false,
  readiness: 80,
  performance: null,
  loadDelta: 0,
  stressDelta: 0,
  light: "green",
  reasons: [],
  painSpots: [],
  ...extra,
});
const redSpot = { level: "red" } as PainSpotStatus;

describe("pickTip", () => {
  const base = { openFeedback: 0, weekHints: [], testDueInDays: null };

  it("nichts los → kein Tipp", () => {
    expect(pickTip({ ...base, metrics: metrics() })).toBeNull();
  });

  it("Reihenfolge: Schmerz-Rot vor Ampel vor Feedback vor Test vor Woche vor Trends", () => {
    const all = {
      metrics: metrics({ painSpots: [redSpot], light: "red", stressDelta: 40, loadDelta: 40, underload: true }),
      openFeedback: 2,
      weekHints: [{ code: "no_rest_day" as const }],
      testDueInDays: 0,
    };
    expect(pickTip(all)?.code).toBe("pain_red");
    expect(pickTip({ ...all, metrics: metrics({ light: "red" }) })?.code).toBe("light_red");
    expect(pickTip({ ...all, metrics: metrics() })).toEqual({ code: "feedback_open", count: 2 });
    expect(pickTip({ ...all, metrics: metrics(), openFeedback: 0 })?.code).toBe("test_due");
    expect(pickTip({ ...all, metrics: metrics(), openFeedback: 0, testDueInDays: 3 })?.code).toBe("week_hint");
  });

  it("Trends erst ab 20 % über dem Normalwert", () => {
    expect(pickTip({ ...base, metrics: metrics({ stressDelta: 19 }) })).toBeNull();
    expect(pickTip({ ...base, metrics: metrics({ stressDelta: 20 }) })).toEqual({ code: "stress_high", percent: 20 });
    expect(pickTip({ ...base, metrics: metrics({ loadDelta: 25 }) })).toEqual({ code: "load_high", percent: 25 });
    expect(pickTip({ ...base, metrics: metrics({ underload: true }) })?.code).toBe("underload");
  });
});
