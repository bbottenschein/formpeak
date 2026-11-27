import { describe, expect, it } from "vitest";
import { GOAL_TYPES } from "./schema";
import { lowerIsBetter, suggestTests } from "./tests";

describe("suggestTests", () => {
  it("Kondition mit Platz: Yo-Yo zuerst, ohne Platz 3-km-Lauf zuerst", () => {
    expect(suggestTests("endurance", ["pitch", "outdoor"]).map((t) => t.key)).toEqual(["yoyo_ir1", "run3k"]);
    expect(suggestTests("endurance", ["outdoor"]).map((t) => t.key)).toEqual(["run3k", "yoyo_ir1"]);
  });

  it("Schnelligkeit: 10- und 20-m-Sprint, ohne Platz Sprunghöhe zuerst", () => {
    expect(suggestTests("speed", ["pitch"]).map((t) => t.key)).toEqual(["sprint10", "sprint20", "cmj"]);
    expect(suggestTests("speed", ["gym"])[0].key).toBe("cmj");
  });

  it("Kraft: 5RM Kniebeuge mit Studio", () => {
    expect(suggestTests("strength", ["gym"])[0].key).toBe("squat_5rm");
  });

  it("neue Ziele: Muskelaufbau und Gewichtsabnahme", () => {
    expect(suggestTests("muscle_gain", ["gym"]).map((t) => t.key)).toEqual(["squat_5rm", "bench_5rm", "body_weight"]);
    expect(suggestTests("weight_loss", []).map((t) => t.key)).toEqual(["body_weight", "waist"]);
  });

  it("jedes Ziel hat Tests", () => {
    for (const type of GOAL_TYPES) expect(suggestTests(type, []).length).toBeGreaterThan(0);
  });
});

describe("lowerIsBetter", () => {
  it("Körpergewicht hängt vom Ziel ab, Zeiten immer kleiner besser", () => {
    expect(lowerIsBetter("body_weight", "weight_loss")).toBe(true);
    expect(lowerIsBetter("body_weight", "muscle_gain")).toBe(false);
    expect(lowerIsBetter("sprint10", "speed")).toBe(true);
    expect(lowerIsBetter("squat_5rm", "strength")).toBe(false);
  });
});
