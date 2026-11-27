import { describe, expect, it } from "vitest";
import { adjustToday, reducePrescription, type TodayUnit } from "./daily-adjust";
import type { DayAllowance } from "./guardrails";
import type { PainSpotStatus } from "./pain";

const free: DayAllowance = {
  date: "2026-11-30",
  main: true,
  kinds: ["gym", "run_intervals", "mobility", "recovery"],
  maxMinutes: 45,
  maxRpe: 9,
  lowerBody: true,
  reasons: [],
};
const red: DayAllowance = { ...free, main: false, kinds: ["recovery", "mobility"], maxMinutes: 30, maxRpe: 3, lowerBody: false, reasons: ["light_red"] };
const yellow: DayAllowance = { ...free, maxMinutes: 32, maxRpe: 6, reasons: ["light_yellow"] };

const gym: TodayUnit = { id: "g", date: "2026-11-30", kind: "gym", durationMin: 45, targetRpe: 7, lowerBody: true };
const mob: TodayUnit = { id: "m", date: "2026-11-30", kind: "mobility", durationMin: 15, targetRpe: 2, lowerBody: false };
const pain = (level: PainSpotStatus["level"]): PainSpotStatus => ({
  region: "knee",
  side: "left",
  intensity: 4,
  kind: "joint",
  swollen: false,
  seriesDays: 1,
  lastDate: "2026-11-30",
  level,
  seeProfessional: false,
});

describe("adjustToday", () => {
  it("grün und im Rahmen: nichts ändern", () => {
    expect(adjustToday([gym, mob], free, [])).toEqual([
      { id: "g", change: { action: "keep" }, spare: false, reason: null },
      { id: "m", change: { action: "keep" }, spare: false, reason: null },
    ]);
  });

  it("Ampel rot: Gym wird Regeneration (25 min, RPE 2)", () => {
    expect(adjustToday([gym], red, [])).toEqual([
      { id: "g", change: { action: "swap", to: "recovery", durationMin: 25, targetRpe: 2 }, spare: false, reason: "light_red" },
    ]);
  });

  it("Ampel rot mit Mobilität am selben Tag: Gym fällt weg, Mobilität bleibt", () => {
    const res = adjustToday([gym, mob], red, []);
    expect(res.map((r) => r.change.action)).toEqual(["remove", "keep"]);
  });

  it("höchstens ein Ersatz pro Tag", () => {
    const run: TodayUnit = { ...gym, id: "r", kind: "run_intervals", lowerBody: false };
    expect(adjustToday([gym, run], red, []).map((r) => r.change.action)).toEqual(["swap", "remove"]);
  });

  it("Ampel gelb: kürzen auf den Rahmen, RPE kappen", () => {
    expect(adjustToday([gym], yellow, [])).toEqual([
      { id: "g", change: { action: "shorten", durationMin: 32, targetRpe: 6, setFactor: 32 / 45 }, spare: false, reason: "light_yellow" },
    ]);
  });

  it("Ampel gelb, Einheit schon kurz und leicht: bleibt", () => {
    expect(adjustToday([mob], yellow, [])[0].change).toEqual({ action: "keep" });
  });

  it("Schmerz mit Einschränkung: Haupteinheit bleibt, aber Region aussparen", () => {
    expect(adjustToday([gym, mob], free, [pain("restrict")])).toEqual([
      { id: "g", change: { action: "keep" }, spare: true, reason: "pain" },
      { id: "m", change: { action: "keep" }, spare: false, reason: null },
    ]);
  });

  it("Schmerz nur notiert: keine Änderung", () => {
    expect(adjustToday([gym], free, [pain("note")])[0]).toMatchObject({ spare: false, reason: null });
  });

  it("Spieltag (nichts erlaubt): alles fällt weg", () => {
    const md: DayAllowance = { ...free, main: false, kinds: [], maxMinutes: 0, maxRpe: 0, lowerBody: false, reasons: ["matchday"] };
    expect(adjustToday([gym, mob], md, []).map((r) => r.change.action)).toEqual(["remove", "remove"]);
  });
});

describe("reducePrescription", () => {
  it("reduziert Sätze, Rest bleibt", () => {
    expect(reducePrescription("4 × 5, 60 kg", 0.7)).toBe("3 × 5, 60 kg");
    expect(reducePrescription("3x8 je Seite", 0.5)).toBe("2x8 je Seite");
    expect(reducePrescription("1 × 10", 0.3)).toBe("1 × 10");
  });

  it("ohne Satzangabe oder Faktor 1 unverändert", () => {
    expect(reducePrescription("60 s je Seite", 0.7)).toBe("60 s je Seite");
    expect(reducePrescription("4 × 5", 1)).toBe("4 × 5");
  });
});
