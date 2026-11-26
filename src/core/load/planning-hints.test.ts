import { describe, expect, it } from "vitest";
import { isIntense, isUnderloaded, sessionHints, weekHints } from "./planning-hints";
import type { PainSpotStatus } from "./pain";
import { match, session, training } from "./test-helpers";
import type { Session } from "./types";

/**
 * Referenzwoche (Dogfooding): Training Di + Do, Spiel Sa.
 * So 29.11. = MD+1, Mo 30.11. = MD+2, Di 01.12. Training, Mi 02.12. = MD−3,
 * Do 03.12. Training (intensiv), Fr 04.12. = MD−1, Sa 05.12. Spiel.
 */
const FIXTURES: Session[] = [
  match("2026-11-28"),
  training("2026-12-01"),
  training("2026-12-03", { expectedIntensity: "high" }),
  match("2026-12-05"),
];

const planned = (date: string, extra: Partial<Session> = {}) =>
  session({ date, status: "planned", rpe: null, ...extra });

const codes = (s: Session, extra: Partial<Parameters<typeof sessionHints>[1]> = {}) =>
  sessionHints(s, { sessions: [...FIXTURES, s], ...extra }).map((h) => h.code);

describe("isIntense", () => {
  it("Ziel-RPE ≥ 7 oder Standard-RPE ≥ 7", () => {
    expect(isIntense(planned("2026-12-02", { targetRpe: 7 }))).toBe(true);
    expect(isIntense(planned("2026-12-02", { targetRpe: 6 }))).toBe(false);
    expect(isIntense(planned("2026-12-02", { defaultRpe: 8 }))).toBe(true);
    expect(isIntense(session({ date: "2026-12-02", rpe: 9, targetRpe: 3 }))).toBe(true);
  });
});

describe("sessionHints – Unterkörperkraft (frühestens MD+2, spätestens MD−3)", () => {
  const legs = (date: string) => planned(date, { type: "gym", gymFocus: "lower" });

  it("Mo (MD+2) und Mi (MD−3) sind erlaubt", () => {
    expect(codes(legs("2026-11-30"))).toEqual([]);
    expect(codes(legs("2026-12-02"))).toEqual([]);
  });

  it("So (MD+1) ist zu früh", () => {
    expect(codes(legs("2026-11-29"))).toContain("lower_body_too_soon_after_match");
  });

  it("Do (MD−2) und Fr (MD−1) sind zu spät", () => {
    expect(codes(legs("2026-12-03"))).toContain("lower_body_too_close_to_match");
    expect(codes(legs("2026-12-04"))).toContain("lower_body_too_close_to_match");
  });

  it("Ganzkörper zählt wie Unterkörper, Oberkörper nicht", () => {
    expect(codes(planned("2026-12-04", { type: "gym", gymFocus: "full" }))).toContain(
      "lower_body_too_close_to_match",
    );
    expect(codes(planned("2026-12-04", { type: "gym", gymFocus: "upper", durationMin: 30 }))).not.toContain(
      "lower_body_too_close_to_match",
    );
  });
});

describe("sessionHints – Spieltag", () => {
  it("MD+1: keine Intensität, nur Regeneration oder Mobilität", () => {
    expect(codes(planned("2026-11-29", { type: "run_intervals" }))).toContain("md_plus_1_recovery");
    expect(codes(planned("2026-11-29", { type: "recovery" }))).toEqual([]);
  });

  it("MD−1: lang oder intensiv → Hinweis, kurz und locker → okay", () => {
    expect(codes(planned("2026-12-04", { type: "run_intervals", durationMin: 20, targetRpe: 8 }))).toContain(
      "md_minus_1_short",
    );
    expect(codes(planned("2026-12-04", { type: "gym", gymFocus: "upper", durationMin: 45 }))).toContain(
      "md_minus_1_short",
    );
    expect(codes(planned("2026-12-04", { type: "gym", gymFocus: "upper", durationMin: 20, targetRpe: 4 }))).toEqual([]);
    expect(codes(planned("2026-12-04", { type: "mobility", durationMin: 15 }))).toEqual([]);
  });

  it("Spieltag: keine Zusatzeinheit außer Mobilität/Regeneration", () => {
    expect(codes(planned("2026-12-05", { type: "gym", gymFocus: "upper" }))).toContain("matchday_no_extra");
    expect(codes(planned("2026-12-05", { type: "recovery" }))).toEqual([]);
  });
});

describe("sessionHints – Intervalle neben intensivem Teamtraining", () => {
  const intervals = (date: string) => planned(date, { type: "run_intervals", targetRpe: 8, durationMin: 30 });

  it("Mi vor intensivem Do-Training → Hinweis", () => {
    expect(codes(intervals("2026-12-02"))).toContain("intervals_next_to_intense_training");
  });

  it("Mo neben normalem Di-Training → kein Hinweis", () => {
    expect(codes(intervals("2026-11-30"))).not.toContain("intervals_next_to_intense_training");
  });

  it("lockerer Lauf ist keine harte Intervalleinheit", () => {
    const easy = planned("2026-12-02", { type: "run_intervals", targetRpe: 4, durationMin: 30 });
    expect(codes(easy)).not.toContain("intervals_next_to_intense_training");
  });

  it("abgesagtes Training zählt nicht", () => {
    const s = intervals("2026-12-02");
    const fixtures = FIXTURES.map((f) =>
      f.date === "2026-12-03" ? { ...f, status: "cancelled" as const } : f,
    );
    expect(sessionHints(s, { sessions: [...fixtures, s] }).map((h) => h.code)).not.toContain(
      "intervals_next_to_intense_training",
    );
  });
});

describe("sessionHints – Ampel und Schmerz", () => {
  const gym = planned("2026-11-30", { type: "gym", gymFocus: "upper" });
  const mobility = planned("2026-11-30", { type: "mobility" });

  it("Rot → nur Regeneration; Mobilität bleibt ohne Hinweis", () => {
    expect(codes(gym, { light: "red" })).toContain("light_red_only_recovery");
    expect(codes(mobility, { light: "red" })).toEqual([]);
  });

  it("Gelb → um 30 % reduzieren", () => {
    const hints = sessionHints(gym, { sessions: [gym], light: "yellow" });
    expect(hints).toContainEqual({ code: "light_yellow_reduce", percent: 30 });
  });

  it("Grün → kein Ampel-Hinweis", () => {
    expect(codes(gym, { light: "green" })).toEqual([]);
  });

  it("Schmerz-Sperre → Region aussparen", () => {
    const spot: PainSpotStatus = {
      region: "ankle",
      side: "left",
      intensity: 4,
      kind: "joint",
      swollen: false,
      seriesDays: 1,
      lastDate: "2026-11-30",
      level: "restrict",
      seeProfessional: false,
    };
    expect(codes(gym, { painSpots: [spot] })).toContain("pain_spare_region");
    expect(codes(gym, { painSpots: [{ ...spot, level: "note" }] })).not.toContain("pain_spare_region");
  });

  it("Fußballtermine und abgesagte Einheiten bekommen keine Hinweise", () => {
    expect(sessionHints(FIXTURES[1], { sessions: FIXTURES, light: "red" })).toEqual([]);
    const cancelled = { ...gym, status: "cancelled" as const };
    expect(sessionHints(cancelled, { sessions: [cancelled], light: "red" })).toEqual([]);
  });
});

describe("weekHints", () => {
  const TODAY = "2026-11-30";

  it("kein kompletter Ruhetag → Hinweis", () => {
    const days = ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"];
    const sessions = days.map((d) => planned(d, { type: "mobility", durationMin: 10, defaultRpe: 2 }));
    expect(weekHints(TODAY, sessions, TODAY).map((h) => h.code)).toContain("no_rest_day");
  });

  it("abgesagte Einheit macht den Tag wieder zum Ruhetag", () => {
    const days = ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"];
    const sessions = days.map((d, i) =>
      planned(d, { type: "mobility", durationMin: 10, defaultRpe: 2, status: i === 0 ? "cancelled" : "planned" }),
    );
    expect(weekHints(TODAY, sessions, TODAY).map((h) => h.code)).not.toContain("no_rest_day");
  });

  it("Wochenlast +15 % ist okay, darüber Hinweis", () => {
    const prev = session({ date: "2026-11-25", rpe: 5, durationMin: 200 }); // 1000 AU Vorwoche
    const ok = planned("2026-12-01", { targetRpe: 5, durationMin: 230 }); // 1150 AU
    expect(weekHints(TODAY, [prev, ok], TODAY)).toEqual([]);
    const tooMuch = planned("2026-12-01", { targetRpe: 5, durationMin: 240 }); // 1200 AU
    expect(weekHints(TODAY, [prev, tooMuch], TODAY)).toEqual([{ code: "weekly_load_increase", percent: 20 }]);
  });

  it("ohne Vorwochenlast keine Steigerungswarnung", () => {
    expect(weekHints(TODAY, [planned("2026-12-01", { durationMin: 500 })], TODAY)).toEqual([]);
  });
});

describe("isUnderloaded", () => {
  it("unter 0,8 → true, ab 0,8 oder ohne Wert → false", () => {
    expect(isUnderloaded(0.79)).toBe(true);
    expect(isUnderloaded(0.8)).toBe(false);
    expect(isUnderloaded(null)).toBe(false);
  });
});
