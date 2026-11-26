import { describe, expect, it } from "vitest";
import { missingFixtures, seriesDates, type FixtureSeries } from "./series";

const training: FixtureSeries = {
  id: "t",
  kind: "training",
  weekdays: [2, 4], // Di, Do
  startTime: "19:00",
  durationMin: 90,
  expectedIntensity: "medium",
  defaultRpe: 6,
  validFrom: "2026-11-23",
  validUntil: null,
};
const match: FixtureSeries = { ...training, id: "m", kind: "match", weekdays: [6], defaultRpe: 8, expectedIntensity: "high" };

describe("seriesDates", () => {
  it("Referenzwoche: Training Di + Do, Spiel Sa", () => {
    expect(seriesDates(training, "2026-11-30", "2026-12-06")).toEqual(["2026-12-01", "2026-12-03"]);
    expect(seriesDates(match, "2026-11-30", "2026-12-06")).toEqual(["2026-12-05"]);
  });

  it("beachtet gültig ab / bis", () => {
    expect(seriesDates({ ...training, validFrom: "2026-12-02" }, "2026-11-30", "2026-12-06")).toEqual(["2026-12-03"]);
    expect(seriesDates({ ...training, validUntil: "2026-12-02" }, "2026-11-30", "2026-12-06")).toEqual(["2026-12-01"]);
    expect(seriesDates({ ...training, validFrom: "2027-01-01" }, "2026-11-30", "2026-12-06")).toEqual([]);
  });
});

describe("missingFixtures", () => {
  it("legt fehlende Termine an, vorhandene (auch verschobene/abgesagte) nicht doppelt", () => {
    const existing = new Set(["t|2026-12-01"]);
    const rows = missingFixtures([training, match], existing, "2026-11-30", "2026-12-06");
    expect(rows.map((r) => `${r.series_id}|${r.date}`)).toEqual(["t|2026-12-03", "m|2026-12-05"]);
    expect(rows[1]).toMatchObject({
      type: "match",
      status: "planned",
      is_fixture: true,
      default_rpe: 8,
      expected_intensity: "high",
      series_date: "2026-12-05",
    });
  });
});
