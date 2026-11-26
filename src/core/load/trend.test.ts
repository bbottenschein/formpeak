import { describe, expect, it } from "vitest";
import { computeTrend } from "./trend";
import { checkin, session } from "./test-helpers";

const TODAY = "2026-11-26";

describe("computeTrend", () => {
  it("ein Punkt pro Tag, Lücken ohne Check-in sind null und grau", () => {
    const trend = computeTrend("2026-11-24", TODAY, {
      sessions: [session({ date: "2026-11-25", rpe: 6, durationMin: 90 })],
      morningCheckins: [checkin({ date: "2026-11-24" }), checkin({ date: TODAY, energy: 1, soreness: 5, stress: 5 })],
      painEntries: [],
      firstDataDate: "2026-11-24",
      today: TODAY,
    });
    expect(trend.map((p) => p.date)).toEqual(["2026-11-24", "2026-11-25", "2026-11-26"]);
    expect(trend[0]).toMatchObject({ readiness: 100, light: "green", load: 0 });
    expect(trend[1]).toMatchObject({ readiness: null, light: "grey", load: 540 });
    expect(trend[2].readiness).toBeLessThan(50);
    expect(trend[2].light).toBe("red");
  });

  it("Ruhepuls-Basis gilt je Tag nur aus früheren Messungen", () => {
    const trend = computeTrend("2026-11-25", TODAY, {
      sessions: [],
      morningCheckins: [
        checkin({ date: "2026-11-22", restingHr: 60 }),
        checkin({ date: "2026-11-23", restingHr: 60 }),
        checkin({ date: "2026-11-24", restingHr: 60 }),
        checkin({ date: "2026-11-25", restingHr: 84 }),
        checkin({ date: TODAY, restingHr: 60 }),
      ],
      painEntries: [],
      firstDataDate: "2026-11-22",
      today: TODAY,
    });
    expect(trend[0].readiness).toBe(90); // +24 über Basis 60
    expect(trend[1].readiness).toBe(100); // Basis jetzt 66, 60 ist kein Abzug
  });
});
