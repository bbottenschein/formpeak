import { describe, expect, it } from "vitest";
import { suggestTests } from "./tests";

describe("suggestTests", () => {
  it("Kondition mit Platz: Yo-Yo zuerst", () => {
    expect(suggestTests("endurance", ["pitch", "outdoor"]).map((t) => t.key)).toEqual(["yoyo_ir1", "cooper12"]);
  });

  it("Kondition ohne Platz: Cooper-Test zuerst, Yo-Yo hinten", () => {
    expect(suggestTests("endurance", ["outdoor"]).map((t) => t.key)).toEqual(["cooper12", "yoyo_ir1"]);
  });

  it("jedes Ziel hat mindestens einen Test, der ohne Ausrüstung geht oder bevorzugt wird", () => {
    for (const type of ["endurance", "speed", "strength", "prevention", "comeback"] as const) {
      expect(suggestTests(type, ["gym"]).length).toBeGreaterThan(0);
    }
    expect(suggestTests("speed", ["gym"])[0].key).toBe("cmj");
    expect(suggestTests("prevention", [])[0].key).toBe("single_leg_hop");
  });

  it("Einheiten und Richtung", () => {
    const sprint = suggestTests("speed", ["pitch"])[0];
    expect(sprint).toMatchObject({ key: "sprint30", unit: "s", lowerIsBetter: true });
  });
});
