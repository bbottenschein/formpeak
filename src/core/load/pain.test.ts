import { describe, expect, it } from "vitest";
import { activePainSpots, classifyPain } from "./pain";
import { pain } from "./test-helpers";

const D = (n: number) => `2026-11-${String(n).padStart(2, "0")}`;

describe("classifyPain", () => {
  it("Stärke 1–3, ein Tag → nur notieren", () => {
    expect(classifyPain(1, false, 1)).toEqual({ level: "note", seeProfessional: false });
    expect(classifyPain(3, false, 1)).toEqual({ level: "note", seeProfessional: false });
  });

  it("Stärke ≥ 4 oder 2 Tage in Folge → aussparen", () => {
    expect(classifyPain(4, false, 1).level).toBe("restrict");
    expect(classifyPain(5, false, 1).level).toBe("restrict");
    expect(classifyPain(2, false, 2).level).toBe("restrict");
  });

  it("Stärke ≥ 6, Schwellung an Gelenk/Sehne oder mehr als 5 Tage → Rot + Arzt-Hinweis", () => {
    expect(classifyPain(6, false, 1)).toEqual({ level: "red", seeProfessional: true });
    expect(classifyPain(1, true, 1)).toEqual({ level: "red", seeProfessional: true });
    expect(classifyPain(2, false, 5).level).toBe("restrict");
    expect(classifyPain(2, false, 6)).toEqual({ level: "red", seeProfessional: true });
  });
});

describe("activePainSpots", () => {
  it("einzelner leichter Eintrag heute → note", () => {
    const spots = activePainSpots([pain({ date: D(26), intensity: 2 })], new Set([D(26)]), D(26));
    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({ region: "knee", side: "left", seriesDays: 1, level: "note" });
  });

  it("Stärke 0 wird ignoriert", () => {
    expect(activePainSpots([pain({ date: D(26), intensity: 0 })], new Set([D(26)]), D(26))).toEqual([]);
  });

  it("zwei Tage in Folge → restrict", () => {
    const entries = [pain({ date: D(25) }), pain({ date: D(26) })];
    const spots = activePainSpots(entries, new Set([D(25), D(26)]), D(26));
    expect(spots[0]).toMatchObject({ seriesDays: 2, level: "restrict" });
  });

  it("Tage ohne Check-in unterbrechen die Serie nicht", () => {
    const entries = [pain({ date: D(23) }), pain({ date: D(26) })];
    const spots = activePainSpots(entries, new Set([D(23), D(26)]), D(26));
    expect(spots[0].seriesDays).toBe(2);
  });

  it("ein Check-in ohne Eintrag an der Stelle beendet die Serie", () => {
    const entries = [pain({ date: D(23) }), pain({ date: D(26) })];
    const spots = activePainSpots(entries, new Set([D(23), D(24), D(26)]), D(26));
    expect(spots[0].seriesDays).toBe(1);
  });

  it("heutiger Check-in ohne Eintrag → Stelle nicht mehr aktiv", () => {
    const spots = activePainSpots([pain({ date: D(25), intensity: 5 })], new Set([D(25), D(26)]), D(26));
    expect(spots).toEqual([]);
  });

  it("noch kein Check-in heute → Stelle von gestern bleibt aktiv", () => {
    const spots = activePainSpots([pain({ date: D(25), intensity: 5 })], new Set([D(25)]), D(26));
    expect(spots[0]).toMatchObject({ intensity: 5, lastDate: D(25), level: "restrict" });
  });

  it("mehr als 5 Tage → Rot", () => {
    const days = [21, 22, 23, 24, 25, 26].map(D);
    const spots = activePainSpots(days.map((d) => pain({ date: d })), new Set(days), D(26));
    expect(spots[0]).toMatchObject({ seriesDays: 6, level: "red", seeProfessional: true });
  });

  it("genau 5 Tage → noch kein Rot", () => {
    const days = [22, 23, 24, 25, 26].map(D);
    const spots = activePainSpots(days.map((d) => pain({ date: d })), new Set(days), D(26));
    expect(spots[0]).toMatchObject({ seriesDays: 5, level: "restrict" });
  });

  it("Schwellung zählt nur an Gelenk oder Sehne als Rot", () => {
    const muscle = activePainSpots([pain({ date: D(26), swollen: true, kind: "muscle" })], new Set([D(26)]), D(26));
    expect(muscle[0]).toMatchObject({ level: "note", swollen: true });
    const joint = activePainSpots([pain({ date: D(26), swollen: true, kind: "joint" })], new Set([D(26)]), D(26));
    expect(joint[0].level).toBe("red");
    const tendon = activePainSpots(
      [pain({ date: D(26), swollen: true, kind: "tendon", region: "achilles" })],
      new Set([D(26)]),
      D(26),
    );
    expect(tendon[0].level).toBe("red");
  });

  it("mehrere Einträge am Tag (Check-in + Feedback) → höchster Wert zählt, ein Serientag", () => {
    const entries = [pain({ date: D(26), intensity: 2 }), pain({ date: D(26), intensity: 7 })];
    const spots = activePainSpots(entries, new Set([D(26)]), D(26));
    expect(spots[0]).toMatchObject({ intensity: 7, seriesDays: 1, level: "red" });
  });

  it("Seiten und Regionen sind getrennte Stellen", () => {
    const entries = [
      pain({ date: D(25), side: "left" }),
      pain({ date: D(26), side: "right" }),
      pain({ date: D(26), side: "left", region: "calf" }),
    ];
    const spots = activePainSpots(entries, new Set([D(25), D(26)]), D(26));
    expect(spots).toHaveLength(2);
    expect(spots.every((s) => s.seriesDays === 1)).toBe(true);
  });

  it("Einträge nach dem Stichtag werden ignoriert", () => {
    expect(activePainSpots([pain({ date: D(27) })], new Set(), D(26))).toEqual([]);
  });
});
