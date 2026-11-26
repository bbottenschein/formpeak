import { describe, expect, it } from "vitest";
import {
  computeReadiness,
  restingHrBaseline,
  restingHrFromCount,
  restingHrScore,
  sleepDurationScore,
} from "./readiness";
import { checkin } from "./test-helpers";

const DAY = "2026-11-26";

describe("Teilwerte", () => {
  it("Schlafdauer: ≤ 5 h = 0, 6,5 h = 50, ≥ 8 h = 100", () => {
    expect(sleepDurationScore(4)).toBe(0);
    expect(sleepDurationScore(5)).toBe(0);
    expect(sleepDurationScore(6.5)).toBe(50);
    expect(sleepDurationScore(8)).toBe(100);
    expect(sleepDurationScore(10)).toBe(100);
  });

  it("Ruhepuls: unter +8 kein Abzug, +20 und mehr = 0, linear dazwischen", () => {
    expect(restingHrScore(50, 60)).toBe(100); // niedriger ist kein Abzug
    expect(restingHrScore(67.9, 60)).toBe(100);
    expect(restingHrScore(68, 60)).toBe(100);
    expect(restingHrScore(74, 60)).toBe(50);
    expect(restingHrScore(80, 60)).toBe(0);
    expect(restingHrScore(90, 60)).toBe(0);
  });

  it("Ruhepuls-Basis: Mittel der letzten 7, erst ab 3 Messungen", () => {
    expect(restingHrBaseline([60, 60])).toBeNull();
    expect(restingHrBaseline([54, 60, 66])).toBe(60);
    expect(restingHrBaseline([100, 100, 60, 60, 60, 60, 60, 60, 60])).toBe(60);
  });

  it("10-Sekunden-Zählung × 6", () => {
    expect(restingHrFromCount(10)).toBe(60);
    expect(restingHrFromCount(11)).toBe(66);
  });
});

describe("computeReadiness", () => {
  it("bestmöglicher Check-in = 100", () => {
    expect(computeReadiness(checkin({ date: DAY }), []).score).toBe(100);
  });

  it("schlechtester Check-in = 0", () => {
    const c = checkin({ date: DAY, sleepHours: 3, sleepQuality: 1, energy: 1, soreness: 5, stress: 5 });
    expect(computeReadiness(c, []).score).toBe(0);
  });

  it("Muskelkater und Stress werden umgekehrt gewertet", () => {
    const r = computeReadiness(checkin({ date: DAY, soreness: 5, stress: 5 }), []);
    expect(r.factors.soreness).toBe(0);
    expect(r.factors.stress).toBe(0);
    // ohne Ruhepuls: 55 von 90 Gewichtspunkten bleiben voll → 61,1 → 61
    expect(r.score).toBe(61);
  });

  it("Gewichte: alle Faktoren mittel (3) und 6,5 h Schlaf → 50", () => {
    const c = checkin({ date: DAY, sleepHours: 6.5, sleepQuality: 3, energy: 3, soreness: 3, stress: 3 });
    expect(computeReadiness(c, []).score).toBe(50);
  });

  it("ohne Ruhepuls werden die übrigen Gewichte hochskaliert", () => {
    // Nur Energie schlecht: ohne Puls 25/90 Abzug → 72; mit Puls (voll) 25/100 Abzug → 75
    const c = checkin({ date: DAY, energy: 1 });
    expect(computeReadiness(c, []).score).toBe(72);
    expect(computeReadiness({ ...c, restingHr: 60 }, [60, 60, 60]).score).toBe(75);
  });

  it("Ruhepuls ohne Basis (unter 3 Messungen) zählt nicht", () => {
    const r = computeReadiness(checkin({ date: DAY, restingHr: 90 }), [60, 60]);
    expect(r.factors.restingHr).toBeNull();
    expect(r.restingHrBaseline).toBeNull();
    expect(r.score).toBe(100);
  });

  it("erhöhter Ruhepuls senkt den Score um bis zu 10 Punkte", () => {
    const r = computeReadiness(checkin({ date: DAY, restingHr: 84 }), [60, 60, 60]);
    expect(r.factors.restingHr).toBe(0);
    expect(r.score).toBe(90);
  });
});
