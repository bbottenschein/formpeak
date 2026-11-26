import { describe, expect, it } from "vitest";
import { e1rmSeries, painHistory, weeklyVolume, type LoggedSet } from "./logic";

describe("painHistory", () => {
  it("je Stelle: Tageshöchstwert, Tage mit Schmerz, Maximum, zuletzt betroffen zuerst", () => {
    const rows = painHistory(
      [
        { date: "2026-11-20", region: "knee", side: "left", intensity: 3 },
        { date: "2026-11-20", region: "knee", side: "left", intensity: 5 },
        { date: "2026-11-22", region: "knee", side: "left", intensity: 2 },
        { date: "2026-11-25", region: "calf", side: "right", intensity: 4 },
        { date: "2026-11-01", region: "ankle", side: "left", intensity: 7 }, // außerhalb
        { date: "2026-11-23", region: "hip", side: "left", intensity: 0 }, // ignoriert
      ],
      "2026-11-19",
      "2026-11-26",
    );
    expect(rows.map((r) => `${r.region}|${r.side}`)).toEqual(["calf|right", "knee|left"]);
    expect(rows[1]).toMatchObject({ daysWithPain: 2, maxIntensity: 5, lastDate: "2026-11-22" });
    expect(rows[1].days).toHaveLength(8);
    expect(rows[1].days.find((d) => d.date === "2026-11-20")?.intensity).toBe(5);
    expect(rows[1].days.find((d) => d.date === "2026-11-21")?.intensity).toBe(0);
  });
});

const set = (date: string, exerciseId: string, weightKg: number, reps: number, muscleGroup = "legs", setType: "working" | "warmup" = "working"): LoggedSet => ({
  date,
  exerciseId,
  muscleGroup,
  weightKg,
  reps,
  rir: null,
  setType,
});

describe("e1rmSeries", () => {
  it("bestes 1RM pro Tag, chronologisch, Aufwärmsätze zählen nicht", () => {
    const series = e1rmSeries(
      [
        set("2026-11-26", "squat", 62.5, 8),
        set("2026-11-19", "squat", 60, 8),
        set("2026-11-19", "squat", 100, 5, "legs", "warmup"),
        set("2026-11-19", "bench", 80, 5),
      ],
      "squat",
    );
    expect(series).toEqual([
      { date: "2026-11-19", e1rm: 76 },
      { date: "2026-11-26", e1rm: 79 },
    ]);
  });
});

describe("weeklyVolume", () => {
  it("Volumen je Muskelgruppe und Woche (Mo–So), älteste Woche zuerst", () => {
    const weeks = weeklyVolume(
      [
        set("2026-11-26", "squat", 60, 8),
        set("2026-11-23", "rdl", 50, 10, "posterior_chain"),
        set("2026-11-17", "squat", 60, 5),
        set("2026-11-17", "squat", 40, 10, "legs", "warmup"),
      ],
      "2026-11-26",
      2,
    );
    expect(weeks).toEqual([
      { week: "2026-11-16", byGroup: { legs: 300 } },
      { week: "2026-11-23", byGroup: { legs: 480, posterior_chain: 500 } },
    ]);
  });
});
