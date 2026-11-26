import { describe, expect, it } from "vitest";
import { EMPTY_MORNING, parseMorningPayload } from "./schema";

const valid = { ...EMPTY_MORNING, restingHr: 60 };
const parse = (x: unknown) => parseMorningPayload(JSON.stringify(x));

describe("parseMorningPayload", () => {
  it("akzeptiert gültige Werte", () => {
    expect(parse(valid)).toEqual(valid);
    expect(parse({ ...valid, restingHr: null })).not.toBeNull();
  });

  it("lehnt ungültiges JSON und fremde Typen ab", () => {
    expect(parseMorningPayload("{")).toBeNull();
    expect(parseMorningPayload(null)).toBeNull();
  });

  it("Skalen nur 1–5, Schlaf in halben Stunden", () => {
    expect(parse({ ...valid, energy: 0 })).toBeNull();
    expect(parse({ ...valid, stress: 6 })).toBeNull();
    expect(parse({ ...valid, energy: 2.5 })).toBeNull();
    expect(parse({ ...valid, sleepHours: 7.25 })).toBeNull();
    expect(parse({ ...valid, sleepHours: 17 })).toBeNull();
  });

  it("Ruhepuls plausibel", () => {
    expect(parse({ ...valid, restingHr: 18 })).toBeNull();
    expect(parse({ ...valid, restingHr: 300 })).toBeNull();
  });

  it("Schmerz: gültige Region, passende Seite, Stärke 1–10", () => {
    const knee = { region: "knee", side: "left", intensity: 4, kind: "joint", swollen: false };
    expect(parse({ ...valid, pains: [knee] })?.pains).toHaveLength(1);
    expect(parse({ ...valid, pains: [{ ...knee, region: "elbow" }] })).toBeNull();
    expect(parse({ ...valid, pains: [{ ...knee, side: "center" }] })).toBeNull();
    expect(parse({ ...valid, pains: [{ ...knee, region: "lower_back", side: "left" }] })).toBeNull();
    expect(parse({ ...valid, pains: [{ ...knee, region: "lower_back", side: "center" }] })).not.toBeNull();
    expect(parse({ ...valid, pains: [{ ...knee, intensity: 0 }] })).toBeNull();
    expect(parse({ ...valid, pains: [{ ...knee, intensity: 11 }] })).toBeNull();
  });

  it("dieselbe Stelle nicht doppelt", () => {
    const knee = { region: "knee", side: "left", intensity: 4, kind: "joint", swollen: false };
    expect(parse({ ...valid, pains: [knee, { ...knee, intensity: 2 }] })).toBeNull();
    expect(parse({ ...valid, pains: [knee, { ...knee, side: "right" }] })).not.toBeNull();
  });
});
