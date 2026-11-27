import { describe, expect, it } from "vitest";
import { formatClock, parsePrescription } from "./prescription";

describe("parsePrescription", () => {
  it("Sätze × Wiederholungen mit Gewicht", () => {
    expect(parsePrescription("4 × 5, 60 kg")).toEqual({ sets: 4, reps: 5, weightKg: 60, seconds: null });
    expect(parsePrescription("3x8 je Seite")).toEqual({ sets: 3, reps: 8, weightKg: null, seconds: null });
    expect(parsePrescription("3 × 10, 22,5 kg")).toMatchObject({ weightKg: 22.5 });
  });

  it("Zeitvorgaben für den Timer", () => {
    expect(parsePrescription("60 s je Seite")).toEqual({ sets: null, reps: null, weightKg: null, seconds: 60 });
    expect(parsePrescription("4 × 4 min")).toEqual({ sets: 4, reps: null, weightKg: null, seconds: 240 });
    expect(parsePrescription("3 × 20 s je Seite")).toMatchObject({ sets: 3, reps: null, seconds: 20 });
    expect(parsePrescription("15 min")).toMatchObject({ seconds: 900 });
  });

  it("Strecken sind keine Wiederholungen", () => {
    expect(parsePrescription("3 × 20 m")).toEqual({ sets: 3, reps: null, weightKg: null, seconds: null });
  });

  it("freier Text", () => {
    expect(parsePrescription("locker")).toEqual({ sets: null, reps: null, weightKg: null, seconds: null });
  });
});

describe("formatClock", () => {
  it("m:ss", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-3)).toBe("0:00");
  });
});
