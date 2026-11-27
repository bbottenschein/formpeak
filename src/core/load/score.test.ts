import { describe, expect, it } from "vitest";
import { computeReadiness } from "./readiness";
import { biggestDrag, computePerformanceScore, loadCorrection, loadVsNormal, stressVsNormal } from "./score";
import { checkin } from "./test-helpers";

const DAY = "2026-11-26";

describe("loadCorrection (Grenzen)", () => {
  it("≤ 1,3 → 0, 1,31–1,5 → 10, > 1,5 → 20, ohne Wert → 0", () => {
    expect(loadCorrection(null)).toBe(0);
    expect(loadCorrection(1.3)).toBe(0);
    expect(loadCorrection(1.31)).toBe(10);
    expect(loadCorrection(1.5)).toBe(10);
    expect(loadCorrection(1.51)).toBe(20);
  });
});

describe("computePerformanceScore", () => {
  it("Bestwerte: 100, nichts verloren, Gewichte ohne Puls auf 100 % hochskaliert", () => {
    const r = computePerformanceScore(computeReadiness(checkin({ date: DAY }), []), 1);
    expect(r.score).toBe(100);
    expect(r.mood).toBe("good");
    const sleep = r.components.find((c) => c.key === "sleepDuration")!;
    expect(sleep.weight).toBe(16.7); // 15 / 90
    expect(r.components.find((c) => c.key === "restingHr")).toMatchObject({ weight: 0, value: null });
    expect(r.components.reduce((s, c) => s + c.lost, 0)).toBe(0);
  });

  it("Beiträge summieren sich zur Erholung, verlorene Punkte erklären den Rest", () => {
    const c = checkin({ date: DAY, sleepHours: 6.5, energy: 2, restingHr: 60 });
    const r = computePerformanceScore(computeReadiness(c, [60, 60, 60]), 1);
    const sumPoints = r.components.filter((x) => x.key !== "load").reduce((s, x) => s + x.points, 0);
    expect(Math.round(sumPoints)).toBe(r.recovery);
    expect(r.components.find((x) => x.key === "sleepDuration")).toMatchObject({ weight: 15, value: 50, lost: 7.5 });
    expect(r.components.find((x) => x.key === "energy")).toMatchObject({ weight: 25, value: 25, lost: 18.8 });
    expect(biggestDrag(r)?.key).toBe("energy");
  });

  it("Belastungskorrektur zieht ab und erscheint als eigene Zeile", () => {
    const readiness = computeReadiness(checkin({ date: DAY }), []);
    const r = computePerformanceScore(readiness, 1.45);
    expect(r).toMatchObject({ recovery: 100, correction: 10, score: 90 });
    expect(r.components.find((x) => x.key === "load")).toMatchObject({ points: -10, lost: 10 });
    expect(computePerformanceScore(readiness, 1.8).score).toBe(80);
  });

  it("Score nie unter 0, Stimmung nach Schwellen 70/50", () => {
    const bad = computeReadiness(checkin({ date: DAY, sleepHours: 3, sleepQuality: 1, energy: 1, soreness: 5, stress: 5 }), []);
    expect(computePerformanceScore(bad, 2).score).toBe(0);
    expect(computePerformanceScore(bad, 2).mood).toBe("low");
    const mid = computeReadiness(checkin({ date: DAY, sleepHours: 6.5, sleepQuality: 3, energy: 3, soreness: 3, stress: 3 }), []);
    expect(computePerformanceScore(mid, 1).mood).toBe("medium"); // 50
  });

  it("biggestDrag erst ab 3 Punkten", () => {
    const r = computePerformanceScore(computeReadiness(checkin({ date: DAY, sleepHours: 7.5 }), []), 1);
    expect(biggestDrag(r)).toBeNull(); // Schlaf 83 → 2,8 Punkte
  });
});

describe("Vergleich mit dem Normalwert", () => {
  it("Belastung: ACWR 1,2 → +20 %, 0,85 → −15 %, ohne ACWR null", () => {
    expect(loadVsNormal(1.2)).toBe(20);
    expect(loadVsNormal(0.85)).toBe(-15);
    expect(loadVsNormal(null)).toBeNull();
  });

  it("Stress: letzte 7 Tage vs. 3 Wochen davor, Morgen und Abend gemischt", () => {
    const entries = [
      ...["2026-11-01", "2026-11-05", "2026-11-10", "2026-11-15"].map((date) => ({ date, stress: 2 })),
      ...["2026-11-21", "2026-11-23", "2026-11-25", "2026-11-26"].map((date) => ({ date, stress: 3 })),
    ];
    expect(stressVsNormal(entries, DAY)).toBe(50);
  });

  it("Stress: zu wenige Werte → null", () => {
    expect(stressVsNormal([{ date: DAY, stress: 3 }], DAY)).toBeNull();
  });
});
