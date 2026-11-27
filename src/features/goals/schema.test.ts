import { describe, expect, it } from "vitest";
import { goalSaveSchema, goalSchema } from "./schema";

const goal = {
  type: "endurance",
  focuses: ["endurance"],
  testKeys: ["yoyo_ir1"],
  targets: { yoyo_ir1: 1600 },
  description: "90 Minuten durchlaufen",
  testKey: "yoyo_ir1",
  testName: "Yo-Yo-Test",
  aiSummary: null,
  baselineValue: 1200,
  targetValue: 1600,
  unit: "m",
  targetDate: "2027-03-01",
  extraSessionsPerWeek: 2,
  timeBudgetMin: 60,
  availableWeekdays: [1, 3],
  equipment: ["gym", "outdoor"],
};

describe("goalSchema", () => {
  it("mehrere Schwerpunkte (max. 3), erster = type", () => {
    expect(goalSchema.safeParse({ ...goal, focuses: ["endurance", "speed"], testKeys: ["yoyo_ir1", "sprint10"] }).success).toBe(true);
    expect(goalSchema.safeParse({ ...goal, focuses: ["speed", "endurance"] }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, focuses: [] }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, focuses: ["endurance", "speed", "strength", "prevention"] }).success).toBe(false);
  });

  it("gültiges Ziel, Test optional", () => {
    expect(goalSchema.safeParse(goal).success).toBe(true);
    expect(
      goalSchema.safeParse({ ...goal, testKey: null, testName: null, baselineValue: null, targetValue: null, unit: null, targetDate: null })
        .success,
    ).toBe(true);
  });

  it("Pflichtangaben", () => {
    expect(goalSchema.safeParse({ ...goal, description: "  " }).success).toBe(false);
    expect(goalSaveSchema.safeParse({ ...goal, equipment: [] }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, extraSessionsPerWeek: 8 }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, type: "fun" }).success).toBe(false);
  });

  it("Testwerte nur mit Test", () => {
    expect(goalSchema.safeParse({ ...goal, testKey: null, testName: null }).success).toBe(false);
  });

  it("genau so viele Tage wie Zusatzeinheiten", () => {
    expect(goalSchema.safeParse({ ...goal, availableWeekdays: [1] }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, availableWeekdays: [1, 3, 5] }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, extraSessionsPerWeek: 3, availableWeekdays: [1, 3, 5] }).success).toBe(true);
  });

  it("0 Zusatzeinheiten ist erlaubt (nur Fußball), dann ohne Tage und Trainingsmittel", () => {
    expect(goalSaveSchema.safeParse({ ...goal, extraSessionsPerWeek: 0, availableWeekdays: [], equipment: [] }).success).toBe(true);
  });
});
