import { describe, expect, it } from "vitest";
import type { PainSpotStatus } from "./pain";
import { computeTrafficLight } from "./traffic-light";

const spot = (level: PainSpotStatus["level"]): PainSpotStatus => ({
  region: "knee",
  side: "left",
  intensity: level === "red" ? 7 : 2,
  kind: "joint",
  swollen: false,
  seriesDays: 1,
  lastDate: "2026-11-26",
  level,
  seeProfessional: level === "red",
});

const light = (readiness: number | null, acwr: number | null, painSpots: PainSpotStatus[] = []) =>
  computeTrafficLight({ readiness, acwr, painSpots }).light;

describe("computeTrafficLight", () => {
  it("ohne Check-in → grau", () => {
    expect(light(null, 1)).toBe("grey");
    expect(light(null, 2, [spot("red")])).toBe("grey");
  });

  it("Readiness-Grenzen: 70 grün, 69 gelb, 50 gelb, 49 rot", () => {
    expect(light(70, 1)).toBe("green");
    expect(light(69, 1)).toBe("yellow");
    expect(light(50, 1)).toBe("yellow");
    expect(light(49, 1)).toBe("red");
  });

  it("ACWR-Grenzen: 1,3 grün, 1,31 gelb, 1,5 gelb, 1,51 rot", () => {
    expect(light(90, 1.3)).toBe("green");
    expect(light(90, 1.31)).toBe("yellow");
    expect(light(90, 1.5)).toBe("yellow");
    expect(light(90, 1.51)).toBe("red");
  });

  it("ACWR nicht verfügbar (Kalibrierung) → nur Readiness und Schmerz", () => {
    expect(light(90, null)).toBe("green");
    expect(light(60, null)).toBe("yellow");
  });

  it("Unterlast ändert die Ampel nicht", () => {
    expect(light(90, 0.5)).toBe("green");
  });

  it("Schmerz-Rot-Regel → rot, auch bei bester Readiness", () => {
    expect(light(100, 1, [spot("red")])).toBe("red");
    expect(light(100, 1, [spot("restrict")])).toBe("green");
  });

  it("rot sammelt alle Gründe", () => {
    const r = computeTrafficLight({ readiness: 40, acwr: 1.8, painSpots: [spot("red")] });
    expect(r.reasons.map((x) => x.code)).toEqual(["readiness_low", "acwr_spike", "pain_red"]);
  });

  it("gelb sammelt alle Gründe, grün meldet all_good", () => {
    expect(
      computeTrafficLight({ readiness: 60, acwr: 1.4, painSpots: [] }).reasons.map((x) => x.code),
    ).toEqual(["readiness_medium", "acwr_elevated"]);
    expect(computeTrafficLight({ readiness: 80, acwr: 1, painSpots: [] }).reasons).toEqual([
      { code: "all_good" },
    ]);
  });
});
