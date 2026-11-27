import { describe, expect, it } from "vitest";
import { estimated1rmFrom5rm, finalTestDate, goalOutcome, nextTestDate, progress, testSchedule, type TestEntry } from "./progress";

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

describe("goalOutcome", () => {
  const sprint = (values: number[], target: number | null = null) => ({ values, target, lowerIsBetter: true });
  const squat = (values: number[], target: number | null = null) => ({ values, target, lowerIsBetter: false });
  it("alle Zielwerte erreicht → geschafft", () => {
    expect(goalOutcome([sprint([1.95, 1.84], 1.85), squat([80, 92.5], 90)])).toBe("achieved");
  });
  it("ohne Zielwert zählt Verbesserung", () => {
    expect(goalOutcome([sprint([1.95, 1.9])])).toBe("achieved");
  });
  it("einer verbessert, anderer nicht erreicht → teilweise", () => {
    expect(goalOutcome([sprint([1.95, 1.9], 1.8), squat([80, 80])])).toBe("partly");
  });
  it("nichts verbessert → nicht geschafft", () => {
    expect(goalOutcome([sprint([1.95, 2.0])])).toBe("missed");
  });
  it("ein Test ohne Abschlusswert → höchstens teilweise", () => {
    expect(goalOutcome([sprint([1.95, 1.84], 1.85), squat([80])])).toBe("partly");
  });
  it("nur ein Wert → offen", () => {
    expect(goalOutcome([sprint([1.95])])).toBe("open");
    expect(goalOutcome([])).toBe("open");
  });
});

describe("finalTestDate", () => {
  it("Zieldatum frei → Zieldatum", () => {
    expect(finalTestDate("2027-01-10", new Set(), "2026-12-01")).toBe("2027-01-10");
  });
  it("Zieldatum mit Spiel → Tag davor ohne Termin", () => {
    expect(finalTestDate("2027-01-09", new Set(["2027-01-09", "2027-01-08"]), "2026-12-01")).toBe("2027-01-07");
  });
  it("nie vor dem frühesten Tag; kein freier Tag → Zieldatum", () => {
    expect(finalTestDate("2026-12-02", new Set(["2026-12-02", "2026-12-01"]), "2026-12-01")).toBe("2026-12-02");
    expect(finalTestDate("2026-12-02", new Set(["2026-12-02"]), "2026-12-01")).toBe("2026-12-01");
  });
});
