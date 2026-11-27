import { describe, expect, it } from "vitest";
import { suggestRoutine, type RoutineContext } from "./routines";

const ctx = (extra: Partial<RoutineContext> = {}): RoutineContext => ({
  goalType: "speed",
  light: "green",
  md: { daysToNext: 4, daysSinceLast: 3 },
  hasFixtureToday: false,
  equipment: ["pitch", "gym", "outdoor"],
  ...extra,
});

describe("suggestRoutine", () => {
  it("freier, grüner Tag → Zielroutine", () => {
    expect(suggestRoutine(ctx())?.key).toBe("acceleration");
    expect(suggestRoutine(ctx({ goalType: "endurance" }))?.key).toBe("intervals_4x4");
    expect(suggestRoutine(ctx({ goalType: "muscle_gain" }))?.key).toBe("strength_full");
    expect(suggestRoutine(ctx({ goalType: "weight_loss" }))?.key).toBe("easy_run");
  });

  it("Spieltag → nichts, MD+1 → Regeneration, MD−1 → Aktivierung", () => {
    expect(suggestRoutine(ctx({ md: { daysToNext: 0, daysSinceLast: 0 } }))).toBeNull();
    expect(suggestRoutine(ctx({ md: { daysToNext: 6, daysSinceLast: 1 } }))?.key).toBe("recovery_flush");
    expect(suggestRoutine(ctx({ md: { daysToNext: 1, daysSinceLast: 6 } }))?.key).toBe("activation_md1");
  });

  it("Ampel rot → Regeneration, gelb oder ohne Check-in → Mobilität", () => {
    expect(suggestRoutine(ctx({ light: "red" }))?.key).toBe("recovery_flush");
    expect(suggestRoutine(ctx({ light: "yellow" }))?.key).toBe("mobility_hip_groin");
    expect(suggestRoutine(ctx({ light: "grey" }))?.key).toBe("mobility_hip_groin");
  });

  it("Teamtraining heute → 10 min Mobilität danach", () => {
    expect(suggestRoutine(ctx({ hasFixtureToday: true }))?.key).toBe("mobility_hip_groin");
  });

  it("keine intensive Zielroutine 2 Tage vor dem Spiel, fehlende Mittel → Prävention", () => {
    expect(suggestRoutine(ctx({ md: { daysToNext: 2, daysSinceLast: 5 } }))?.key).toBe("prevention_core");
    expect(suggestRoutine(ctx({ equipment: [] }))?.key).toBe("prevention_core");
  });

  it("ohne Ziel → Prävention", () => {
    expect(suggestRoutine(ctx({ goalType: null }))?.key).toBe("prevention_core");
  });
});
