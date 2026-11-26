import { describe, expect, it } from "vitest";
import { computeDailyMetrics } from "./daily";
import { addDays, dateRange } from "./dates";
import { checkin, pain, session } from "./test-helpers";

const TODAY = "2026-11-26";

describe("computeDailyMetrics", () => {
  it("ohne Check-in: grau, Kalibrierung läuft", () => {
    const m = computeDailyMetrics(TODAY, {
      sessions: [],
      morningCheckins: [],
      painEntries: [],
      firstDataDate: TODAY,
      today: TODAY,
    });
    expect(m).toMatchObject({ light: "grey", readiness: null, acwr: null, calibrationDaysLeft: 27 });
  });

  it("guter Check-in, konstante Last → grün mit ACWR 1", () => {
    const first = addDays(TODAY, -40);
    const sessions = dateRange(first, TODAY).map((d) => session({ date: d, rpe: 5, durationMin: 60 }));
    const m = computeDailyMetrics(TODAY, {
      sessions,
      morningCheckins: [checkin({ date: TODAY })],
      painEntries: [],
      firstDataDate: first,
      today: TODAY,
    });
    expect(m).toMatchObject({ light: "green", readiness: 100, acwr: 1, dayLoad: 300, underload: false });
  });

  it("Belastungsspitze → rot", () => {
    const first = addDays(TODAY, -40);
    const sessions = [
      ...dateRange(first, addDays(TODAY, -7)).map((d) => session({ date: d, rpe: 4, durationMin: 50 })),
      ...dateRange(addDays(TODAY, -6), TODAY).map((d) => session({ date: d, rpe: 8, durationMin: 90 })),
    ];
    const m = computeDailyMetrics(TODAY, {
      sessions,
      morningCheckins: [checkin({ date: TODAY })],
      painEntries: [],
      firstDataDate: first,
      today: TODAY,
    });
    expect(m.light).toBe("red");
    expect(m.acwr!).toBeGreaterThan(1.5);
  });

  it("Ruhepuls-Basis kommt aus früheren Check-ins", () => {
    const checkins = [
      checkin({ date: addDays(TODAY, -3), restingHr: 60 }),
      checkin({ date: addDays(TODAY, -2), restingHr: 60 }),
      checkin({ date: addDays(TODAY, -1), restingHr: 60 }),
      checkin({ date: TODAY, restingHr: 84 }),
    ];
    const m = computeDailyMetrics(TODAY, {
      sessions: [],
      morningCheckins: checkins,
      painEntries: [],
      firstDataDate: addDays(TODAY, -3),
      today: TODAY,
    });
    expect(m.readiness).toBe(90);
  });

  it("starker Schmerz → rot mit aktiver Stelle", () => {
    const m = computeDailyMetrics(TODAY, {
      sessions: [],
      morningCheckins: [checkin({ date: TODAY })],
      painEntries: [pain({ date: TODAY, intensity: 6 })],
      firstDataDate: TODAY,
      today: TODAY,
    });
    expect(m.light).toBe("red");
    expect(m.painSpots[0]).toMatchObject({ level: "red", seeProfessional: true });
  });
});
