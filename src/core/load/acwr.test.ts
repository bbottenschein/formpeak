import { describe, expect, it } from "vitest";
import { computeAcwr, computeEwmaRatio } from "./acwr";
import { addDays, dateRange, type IsoDate } from "./dates";

const DAY = "2026-11-26";

/** Gleichmäßige Last: jeden Tag `perDay` AU von `from` bis `to`. */
function constant(from: IsoDate, to: IsoDate, perDay: number): Map<IsoDate, number> {
  return new Map(dateRange(from, to).map((d) => [d, perDay]));
}

describe("computeAcwr (uncoupled)", () => {
  it("konstante Last → ACWR 1,0", () => {
    const loads = constant(addDays(DAY, -40), DAY, 100);
    const r = computeAcwr(loads, DAY, addDays(DAY, -40));
    expect(r.acute).toBe(700);
    expect(r.chronic).toBe(700);
    expect(r.ratio).toBe(1);
    expect(r.calibrationDaysLeft).toBe(0);
  });

  it("akute Woche ist nicht in der chronischen Last enthalten", () => {
    // 3 Wochen 0, dann eine Woche Last: coupled wäre 700/175 = 4, uncoupled → chronisch 0 → null
    const first = addDays(DAY, -27);
    const loads = constant(addDays(DAY, -6), DAY, 100);
    const r = computeAcwr(loads, DAY, first);
    expect(r.acute).toBe(700);
    expect(r.chronic).toBe(0);
    expect(r.ratio).toBeNull();
  });

  it("chronisch = Summe Tag −27 bis −7 geteilt durch 3", () => {
    const first = addDays(DAY, -27);
    const loads = new Map<IsoDate, number>([
      [addDays(DAY, -27), 300], // gehört zur chronischen Last
      [addDays(DAY, -7), 600], // letzter Tag der chronischen Last
      [addDays(DAY, -6), 450], // erster Tag der akuten Last
      [addDays(DAY, -28), 9999], // außerhalb
    ]);
    const r = computeAcwr(loads, DAY, first);
    expect(r.acute).toBe(450);
    expect(r.chronic).toBe(300);
    expect(r.ratio).toBe(1.5);
  });

  it("Kalibrierung: erst ab 28 Tagen Daten", () => {
    const loads = constant(addDays(DAY, -40), DAY, 100);
    expect(computeAcwr(loads, DAY, addDays(DAY, -26)).calibrationDaysLeft).toBe(1);
    expect(computeAcwr(loads, DAY, addDays(DAY, -26)).ratio).toBeNull();
    expect(computeAcwr(loads, DAY, addDays(DAY, -27)).calibrationDaysLeft).toBe(0);
    expect(computeAcwr(loads, DAY, addDays(DAY, -27)).ratio).toBe(1);
    expect(computeAcwr(loads, DAY, DAY).calibrationDaysLeft).toBe(27);
  });

  it("ohne Daten: nicht verfügbar, volle Kalibrierung", () => {
    const r = computeAcwr(new Map(), DAY, null);
    expect(r).toMatchObject({ acute: 0, chronic: 0, ratio: null, calibrationDaysLeft: 28, ewmaRatio: null });
  });

  it("rundet auf 2 Nachkommastellen", () => {
    const first = addDays(DAY, -27);
    const loads = new Map<IsoDate, number>([
      [addDays(DAY, -20), 300],
      [DAY, 133],
    ]);
    expect(computeAcwr(loads, DAY, first).ratio).toBe(1.33);
  });
});

describe("computeEwmaRatio", () => {
  it("konstante Last → 1", () => {
    const loads = constant(addDays(DAY, -60), DAY, 200);
    expect(computeEwmaRatio(loads, addDays(DAY, -60), DAY)).toBe(1);
  });

  it("Belastungsspitze hebt das Verhältnis über 1", () => {
    const loads = constant(addDays(DAY, -60), DAY, 200);
    for (const d of dateRange(addDays(DAY, -6), DAY)) loads.set(d, 400);
    expect(computeEwmaRatio(loads, addDays(DAY, -60), DAY)!).toBeGreaterThan(1.3);
  });

  it("ohne Last → null, ungültiger Zeitraum → null", () => {
    expect(computeEwmaRatio(new Map(), addDays(DAY, -5), DAY)).toBeNull();
    expect(computeEwmaRatio(new Map(), DAY, addDays(DAY, -1))).toBeNull();
  });

  it("wird in computeAcwr mitgeliefert, auch während der Kalibrierung", () => {
    const loads = constant(addDays(DAY, -10), DAY, 100);
    const r = computeAcwr(loads, DAY, addDays(DAY, -10));
    expect(r.ratio).toBeNull();
    expect(r.ewmaRatio).toBe(1);
  });
});
