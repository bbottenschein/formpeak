import { describe, expect, it } from "vitest";
import type { Session } from "@/core/load";
import { checkinStreak, completionRate, reviewHint, reviewStats, type PlanOutcome } from "./logic";

describe("checkinStreak", () => {
  it("zählt Tage in Folge bis heute", () => {
    expect(checkinStreak(["2026-11-25", "2026-11-26", "2026-11-27"], "2026-11-27")).toBe(3);
  });
  it("heute noch offen: Serie bis gestern bleibt", () => {
    expect(checkinStreak(["2026-11-25", "2026-11-26"], "2026-11-27")).toBe(2);
  });
  it("Lücke beendet die Serie", () => {
    expect(checkinStreak(["2026-11-23", "2026-11-25", "2026-11-26"], "2026-11-26")).toBe(2);
    expect(checkinStreak(["2026-11-20"], "2026-11-27")).toBe(0);
  });
});

describe("completionRate", () => {
  const o = (date: string, status: PlanOutcome["status"], extra: Partial<PlanOutcome> = {}): PlanOutcome => ({
    date,
    status,
    suggested: true,
    adjusted: false,
    ...extra,
  });
  it("erledigt / (erledigt + offen + selbst gestrichen), von der App gestrichene zählen nicht", () => {
    const items = [o("2026-11-23", "done"), o("2026-11-24", "planned"), o("2026-11-25", "cancelled"), o("2026-11-26", "cancelled", { adjusted: true }), o("2026-11-26", "done")];
    expect(completionRate(items, "2026-11-01", "2026-12-01", "2026-11-27")).toBe(50);
  });
  it("heute und eigene Einheiten zählen nicht; ohne Vorschläge null", () => {
    expect(completionRate([o("2026-11-27", "planned"), o("2026-11-20", "done", { suggested: false })], "2026-11-01", "2026-12-01", "2026-11-27")).toBeNull();
  });
});

describe("reviewStats", () => {
  const s = (date: string, status: Session["status"], durationMin: number, rpe: number | null): Session => ({
    id: date + status,
    date,
    type: "gym",
    status,
    durationMin,
    rpe,
    defaultRpe: 6,
    isFixture: false,
  });
  it("Woche: erledigt/geplant, Last vs. Vorwoche, Check-ins", () => {
    const sessions = [s("2026-11-17", "done", 60, 5), s("2026-11-23", "done", 60, 6), s("2026-11-25", "planned", 45, null), s("2026-11-26", "cancelled", 30, null)];
    const st = reviewStats(sessions, ["2026-11-23", "2026-11-24", "2026-11-22"], "2026-11-23", "2026-11-30", "2026-11-30");
    expect(st).toEqual({ done: 1, planned: 2, load: 360, prevLoad: 300, loadDelta: 20, checkins: 2, days: 7 });
  });
});

describe("reviewHint", () => {
  const base = { done: 4, planned: 4, load: 1000, prevLoad: 1000, loadDelta: 0, checkins: 7, days: 7 };
  it("Lastsprung > 25 % zuerst", () => expect(reviewHint({ ...base, loadDelta: 30, done: 1 })).toBe("load_spike"));
  it("unter 60 % erledigt", () => expect(reviewHint({ ...base, done: 2 })).toBe("few_done"));
  it("wenige Check-ins", () => expect(reviewHint({ ...base, checkins: 4 })).toBe("few_checkins"));
  it("starker Lastabfall", () => expect(reviewHint({ ...base, loadDelta: -50 })).toBe("load_drop"));
  it("sonst stabil", () => expect(reviewHint(base)).toBe("steady"));
});

describe("reviewStats – Fußballtermine", () => {
  it("vergangene Termine ohne Feedback zählen als erledigt", () => {
    const fixture: Session = { id: "t", date: "2026-11-24", type: "training", status: "planned", durationMin: 90, rpe: null, defaultRpe: 6, isFixture: true };
    expect(reviewStats([fixture], [], "2026-11-23", "2026-11-30", "2026-11-27")).toMatchObject({ done: 1, planned: 1 });
  });
});
