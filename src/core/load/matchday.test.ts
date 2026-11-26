import { describe, expect, it } from "vitest";
import { matchdayContext, matchdayLabel } from "./matchday";

// Referenzwoche: Spiele Sa 28.11. und Sa 05.12.2026
const MATCHES = ["2026-11-28", "2026-12-05"];

const label = (date: string, matches = MATCHES) => matchdayLabel(matchdayContext(date, matches));

describe("matchdayContext", () => {
  it("Abstand zu nächstem und letztem Spiel", () => {
    expect(matchdayContext("2026-12-01", MATCHES)).toEqual({ daysToNext: 4, daysSinceLast: 3 });
    expect(matchdayContext("2026-12-05", MATCHES)).toEqual({ daysToNext: 0, daysSinceLast: 0 });
  });

  it("ohne Spiele → null", () => {
    expect(matchdayContext("2026-12-01", [])).toEqual({ daysToNext: null, daysSinceLast: null });
  });
});

describe("matchdayLabel", () => {
  it("Referenzwoche Di + Do Training, Spiel Sa", () => {
    expect(label("2026-11-29")).toBe("MD+1"); // So
    expect(label("2026-11-30")).toBe("MD+2"); // Mo
    expect(label("2026-12-01")).toBe("MD+3"); // Di: MD+3 und MD−4 → das nähere
    expect(label("2026-12-02")).toBe("MD−3"); // Mi
    expect(label("2026-12-03")).toBe("MD−2"); // Do
    expect(label("2026-12-04")).toBe("MD−1"); // Fr
    expect(label("2026-12-05")).toBe("MD"); // Sa
  });

  it("englische Woche: Spiel Mi und Sa → das nähere Spiel zählt", () => {
    const m = ["2026-12-02", "2026-12-05"];
    expect(label("2026-12-03", m)).toBe("MD+1");
    expect(label("2026-12-04", m)).toBe("MD−1");
  });

  it("gleich weit von zwei Spielen → nächstes Spiel hat Vorrang", () => {
    expect(label("2026-12-03", ["2026-12-01", "2026-12-05"])).toBe("MD−2");
  });

  it("weit weg vom Spiel → kein Label", () => {
    expect(label("2026-12-20", ["2026-12-05"])).toBeNull();
  });
});
