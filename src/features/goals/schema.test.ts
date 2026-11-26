import { describe, expect, it } from "vitest";
import { goalSchema } from "./schema";

const goal = {
  type: "endurance",
  description: "90 Minuten durchlaufen",
  testName: "Yo-Yo-Test",
  baselineValue: 1200,
  targetValue: 1600,
  unit: "m",
  targetDate: "2027-03-01",
  extraSessionsPerWeek: 2,
  timeBudgetMin: 60,
  availableWeekdays: [1, 3, 5],
  equipment: ["gym", "outdoor"],
};

describe("goalSchema", () => {
  it("gültiges Ziel, Test optional", () => {
    expect(goalSchema.safeParse(goal).success).toBe(true);
    expect(
      goalSchema.safeParse({ ...goal, testName: null, baselineValue: null, targetValue: null, unit: null, targetDate: null }).success,
    ).toBe(true);
  });

  it("Pflichtangaben", () => {
    expect(goalSchema.safeParse({ ...goal, description: "  " }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, availableWeekdays: [] }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, equipment: [] }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, extraSessionsPerWeek: 8 }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, type: "fun" }).success).toBe(false);
  });

  it("Testwerte nur mit Testname", () => {
    expect(goalSchema.safeParse({ ...goal, testName: null }).success).toBe(false);
  });

  it("0 Zusatzeinheiten ist erlaubt (nur Fußball)", () => {
    expect(goalSchema.safeParse({ ...goal, extraSessionsPerWeek: 0 }).success).toBe(true);
  });
});
