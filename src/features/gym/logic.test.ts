import { describe, expect, it } from "vitest";
import { best1rm, epley1rm, isPersonalBest, setsFromSuggestion, suggestNext, suggestWeight, volume, type GymSet } from "./logic";

const w = (weightKg: number, reps: number, rir: number | null = null): GymSet => ({ weightKg, reps, rir, setType: "working" });
const warm = (weightKg: number, reps: number): GymSet => ({ weightKg, reps, rir: null, setType: "warmup" });

describe("1RM und Volumen", () => {
  it("Epley: 100 kg × 5 ≈ 116,7 kg, 1 Wdh = Gewicht, 0 → 0", () => {
    expect(epley1rm(100, 5)).toBeCloseTo(116.67, 1);
    expect(epley1rm(100, 1)).toBe(100);
    expect(epley1rm(0, 10)).toBe(0);
    expect(epley1rm(50, 0)).toBe(0);
  });

  it("bestes 1RM nur aus Arbeitssätzen, auf 0,5 gerundet", () => {
    expect(best1rm([warm(140, 5), w(100, 5), w(105, 3)])).toBe(116.5);
    expect(best1rm([warm(60, 10)])).toBe(0);
  });

  it("Volumen nur Arbeitssätze", () => {
    expect(volume([warm(40, 10), w(60, 8), w(60, 8)])).toBe(960);
  });
});

describe("suggestNext", () => {
  it("alle Arbeitssätze mit RIR ≥ 2 → +2,5 kg", () => {
    expect(suggestNext([warm(40, 10), w(60, 8, 2), w(60, 8, 3), w(60, 8, 2)])).toEqual({
      weightKg: 62.5,
      reps: 8,
      sets: 3,
      reason: "progress",
    });
  });

  it("ein Satz mit RIR 1 oder fehlendem RIR → gleich bleiben", () => {
    expect(suggestNext([w(60, 8, 2), w(60, 8, 1)])?.reason).toBe("repeat");
    expect(suggestNext([w(60, 8, 2), w(60, 8)])).toEqual({ weightKg: 60, reps: 8, sets: 2, reason: "repeat" });
  });

  it("Referenz ist der schwerste Satz", () => {
    expect(suggestNext([w(60, 10, 3), w(70, 6, 2)])).toMatchObject({ weightKg: 72.5, reps: 6 });
  });

  it("gelbe Ampel → ein Satz weniger, nicht steigern, mindestens 1", () => {
    expect(suggestNext([w(60, 8, 3), w(60, 8, 3), w(60, 8, 3)], "yellow")).toEqual({
      weightKg: 60,
      reps: 8,
      sets: 2,
      reason: "reduce",
    });
    expect(suggestNext([w(60, 8, 3)], "yellow")?.sets).toBe(1);
  });

  it("rote Ampel oder keine Arbeitssätze → kein Vorschlag", () => {
    expect(suggestNext([w(60, 8, 3)], "red")).toBeNull();
    expect(suggestNext([warm(40, 10)])).toBeNull();
    expect(suggestNext([])).toBeNull();
  });

  it("Körpergewicht: eine Wiederholung mehr statt Gewicht", () => {
    expect(suggestNext([w(0, 6, 2), w(0, 6, 3)])).toEqual({ weightKg: 0, reps: 7, sets: 2, reason: "bodyweight" });
    expect(suggestNext([w(0, 6, 0)])).toMatchObject({ reps: 6, reason: "bodyweight" });
  });
});

describe("setsFromSuggestion", () => {
  it("erzeugt n gleiche Arbeitssätze", () => {
    expect(setsFromSuggestion({ weightKg: 62.5, reps: 8, sets: 3, reason: "progress" })).toEqual([
      w(62.5, 8),
      w(62.5, 8),
      w(62.5, 8),
    ]);
  });
});

describe("suggestWeight – Training ohne RIR", () => {
  it("alle Ziel-Wiederholungen geschafft → +2,5 kg", () => {
    expect(suggestWeight([w(60, 5), w(60, 5), w(60, 5)], 5)).toEqual({ weightKg: 62.5, progressed: true });
  });
  it("ein Satz zu kurz → gleiches Gewicht", () => {
    expect(suggestWeight([w(60, 5), w(60, 4)], 5)).toEqual({ weightKg: 60, progressed: false });
  });
  it("ohne Ziel: höchste Wiederholungszahl des letzten Mals als Ziel", () => {
    expect(suggestWeight([w(40, 8), w(40, 8)], null)).toEqual({ weightKg: 42.5, progressed: true });
  });
  it("ohne Verlauf oder nur Körpergewicht → kein Vorschlag", () => {
    expect(suggestWeight([], 5)).toBeNull();
    expect(suggestWeight([w(0, 10)], 10)).toBeNull();
  });
});

describe("isPersonalBest", () => {
  it("über dem bisherigen besten 1RM", () => {
    expect(isPersonalBest({ weightKg: 102.5, reps: 5 }, 116.5)).toBe(true); // 119,6
    expect(isPersonalBest({ weightKg: 100, reps: 5 }, 116.5)).toBe(false); // 116,7 ≈ gleich
    expect(isPersonalBest({ weightKg: 100, reps: 5 }, null)).toBe(false);
  });
});
