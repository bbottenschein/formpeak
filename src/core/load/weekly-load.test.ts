import { describe, expect, it } from "vitest";
import { match, session, training } from "./test-helpers";
import { isLightExtra, weeklyLoad } from "./weekly-load";

describe("isLightExtra", () => {
  it("Mobilität/Regeneration bis RPE 4, keine Fußballtermine", () => {
    expect(isLightExtra(session({ date: "2026-12-01", type: "mobility", status: "planned", rpe: null, targetRpe: 4 }))).toBe(true);
    expect(isLightExtra(session({ date: "2026-12-01", type: "mobility", status: "planned", rpe: null, targetRpe: 5 }))).toBe(false);
    expect(isLightExtra(session({ date: "2026-12-01", type: "recovery", rpe: 2 }))).toBe(true);
    expect(isLightExtra(session({ date: "2026-12-01", type: "gym", rpe: 2 }))).toBe(false);
    expect(isLightExtra(training("2026-12-01", { defaultRpe: 3 }))).toBe(false);
  });
});

describe("weeklyLoad", () => {
  const monday = "2026-11-30";

  it("leichte Zusatzeinheiten zählen nicht", () => {
    const sessions = [
      training("2026-11-24"),
      training("2026-12-01"),
      session({ date: "2026-12-02", type: "mobility", status: "planned", rpe: null, targetRpe: 2, durationMin: 15 }),
    ];
    expect(weeklyLoad(monday, sessions, "2026-11-30")).toEqual({ planned: 540, reference: 540 });
  });

  it("Vergleichswert: Wochenschnitt der letzten vier Wochen, wenn höher als die Vorwoche", () => {
    const sessions = [
      session({ date: "2026-11-03", durationMin: 100, rpe: 8 }), // 800
      session({ date: "2026-11-10", durationMin: 100, rpe: 8 }), // 800
      session({ date: "2026-11-17", durationMin: 100, rpe: 8 }), // 800
      session({ date: "2026-11-24", durationMin: 50, rpe: 4 }), // 200
    ];
    expect(weeklyLoad(monday, sessions, monday).reference).toBe(650);
  });

  it("kommende Termine der Vorwoche zählen geplant", () => {
    const sessions = [match("2026-11-28")];
    expect(weeklyLoad(monday, sessions, "2026-11-27").reference).toBe(720);
  });
});
