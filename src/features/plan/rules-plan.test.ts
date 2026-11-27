import { describe, expect, it } from "vitest";
import { dayAllowances, type Session } from "@/core/load";
import { rulesPlan } from "./rules-plan";

const fixture = (date: string, type: "training" | "match", extra: Partial<Session> = {}): Session => ({
  id: `${type}-${date}`,
  date,
  type,
  status: "planned",
  durationMin: 90,
  rpe: null,
  defaultRpe: type === "match" ? 8 : 6,
  isFixture: true,
  expectedIntensity: "medium",
  ...extra,
});

// Referenzwoche: Training Di + Do, Spiel Sa (und Sa davor). Zusatzeinheiten Mo, Mi.
const sessions = [
  fixture("2026-11-28", "match"),
  fixture("2026-12-01", "training"),
  fixture("2026-12-03", "training", { expectedIntensity: "high" }),
  fixture("2026-12-05", "match"),
];
const allowances = dayAllowances({
  weekStart: "2026-11-30",
  today: "2026-11-30",
  sessions,
  availableWeekdays: [1, 3],
  timeBudgetMin: 45,
});

describe("rulesPlan – Referenzwoche", () => {
  it("Kraftziel mit Gym: Kraft am Mo, Prävention am Mi (vor intensivem Training), MD−1 Aktivierung, MD+1 Regeneration", () => {
    const plan = rulesPlan(allowances, { goalType: "strength", equipment: ["gym"], maxMainUnits: 2 });
    expect(plan.map((p) => [p.date, p.routine])).toEqual([
      ["2026-11-30", "strength_full"],
      ["2026-12-02", "prevention_core"],
      ["2026-12-04", "activation_md1"],
      ["2026-12-06", "recovery_flush"],
    ]);
    expect(plan[0]).toMatchObject({ durationMin: 45, lowerBody: true });
  });

  it("Kraftziel ohne Gym: Prävention statt Kraft", () => {
    const plan = rulesPlan(allowances, { goalType: "strength", equipment: ["home"], maxMainUnits: 2 });
    expect(plan[0].routine).toBe("prevention_core");
  });

  it("nur eine Einheit gewählt: zweiter freier Tag bekommt kurze Mobilität", () => {
    const plan = rulesPlan(allowances, { goalType: "endurance", equipment: ["outdoor"], maxMainUnits: 1 });
    expect(plan.map((p) => [p.date, p.routine])).toEqual([
      ["2026-11-30", "intervals_4x4"],
      ["2026-12-02", "mobility_hip_groin"],
      ["2026-12-04", "activation_md1"],
      ["2026-12-06", "recovery_flush"],
    ]);
  });

  it("Ausdauer: Intervalle nicht direkt vor intensivem Training (Mi → lockerer Lauf)", () => {
    const plan = rulesPlan(allowances, { goalType: "endurance", equipment: ["outdoor"], maxMainUnits: 2 });
    expect(plan.find((p) => p.date === "2026-12-02")?.routine).toBe("easy_run");
  });
});
