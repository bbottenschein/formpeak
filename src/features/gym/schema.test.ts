import { describe, expect, it } from "vitest";
import { customExerciseSchema, gymLogSchema } from "./schema";

const id = "6f1c2f3e-8a4b-4c5d-9e6f-7a8b9c0d1e2f";
const log = (sets: unknown[]) => ({ exercises: [{ exerciseId: id, note: null, sets }] });
const set = { weightKg: 62.5, reps: 8, rir: 2, setType: "working" };

describe("gymLogSchema", () => {
  it("gültig, auch ohne Sätze und mit Körpergewicht 0", () => {
    expect(gymLogSchema.safeParse(log([set])).success).toBe(true);
    expect(gymLogSchema.safeParse(log([])).success).toBe(true);
    expect(gymLogSchema.safeParse(log([{ ...set, weightKg: 0, rir: null }])).success).toBe(true);
  });

  it("Gewicht nur in 0,5er-Schritten, RIR 0–4", () => {
    expect(gymLogSchema.safeParse(log([{ ...set, weightKg: 62.3 }])).success).toBe(false);
    expect(gymLogSchema.safeParse(log([{ ...set, weightKg: -5 }])).success).toBe(false);
    expect(gymLogSchema.safeParse(log([{ ...set, rir: 5 }])).success).toBe(false);
    expect(gymLogSchema.safeParse(log([{ ...set, reps: 2.5 }])).success).toBe(false);
  });

  it("Übungs-Id muss eine UUID sein", () => {
    expect(gymLogSchema.safeParse({ exercises: [{ exerciseId: "x", note: null, sets: [] }] }).success).toBe(false);
  });
});

describe("customExerciseSchema", () => {
  it("Name 2–60 Zeichen, bekannte Gruppe und Equipment", () => {
    expect(customExerciseSchema.safeParse({ name: "Sled Push", muscleGroup: "legs", equipment: "other" }).success).toBe(true);
    expect(customExerciseSchema.safeParse({ name: "X", muscleGroup: "legs", equipment: "other" }).success).toBe(false);
    expect(customExerciseSchema.safeParse({ name: "Sled", muscleGroup: "neck", equipment: "other" }).success).toBe(false);
  });
});
