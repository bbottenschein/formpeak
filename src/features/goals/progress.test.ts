import { describe, expect, it } from "vitest";
import { estimated1rmFrom5rm, nextTestDate, progress, testSchedule, type TestEntry } from "./progress";

const entry = (e: Partial<TestEntry>): TestEntry => ({
  id: Math.random().toString(36),
  testKey: "sprint10",
  status: "done",
  date: null,
  scheduledFor: null,
  value: null,
  ...e,
});

describe("Testtermine", () => {
  it("Wiederholung nach 5 Wochen", () => {
    expect(nextTestDate("2026-11-27")).toBe("2027-01-01");
  });

  it("nächster geplanter Test mit Countdown, durchgeführte chronologisch", () => {
    const s = testSchedule(
      [
        entry({ date: "2026-12-01", value: 1.85 }),
        entry({ date: "2026-10-27", value: 1.95 }),
        entry({ status: "planned", scheduledFor: "2027-01-05" }),
        entry({ status: "skipped", scheduledFor: "2026-11-01" }),
      ],
      "2026-12-29",
    );
    expect(s.daysUntil).toBe(7);
    expect(s.done.map((d) => d.value)).toEqual([1.95, 1.85]);
  });

  it("überfälliger Test → negativer Countdown; ohne Plan null", () => {
    expect(testSchedule([entry({ status: "planned", scheduledFor: "2026-12-01" })], "2026-12-03").daysUntil).toBe(-2);
    expect(testSchedule([], "2026-12-03")).toMatchObject({ next: null, daysUntil: null });
  });
});

describe("progress", () => {
  it("Sprint: kleiner ist besser", () => {
    expect(progress([1.95, 1.9, 1.85], 1.8, true)).toEqual({
      first: 1.95,
      latest: 1.85,
      improvement: 0.1,
      improvementPct: 5.1,
      towardTargetPct: 67,
    });
  });

  it("Yo-Yo: größer ist besser, Ziel überschritten → 100 %", () => {
    expect(progress([1200, 1700], 1600, false)).toMatchObject({ improvement: 500, towardTargetPct: 100 });
  });

  it("Verschlechterung wird negativ, Fortschritt zum Ziel nicht unter 0", () => {
    expect(progress([1200, 1100], 1600, false)).toMatchObject({ improvement: -100, towardTargetPct: 0 });
  });

  it("weniger als zwei Werte → null, ohne Ziel kein Zielanteil", () => {
    expect(progress([1200], 1600, false)).toBeNull();
    expect(progress([80, 78], null, true)?.towardTargetPct).toBeNull();
  });

  it("5RM → geschätztes 1RM", () => {
    expect(estimated1rmFrom5rm(100)).toBe(116.5);
  });
});
