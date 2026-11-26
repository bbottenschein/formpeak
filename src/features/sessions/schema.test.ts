import { describe, expect, it } from "vitest";
import { feedbackSchema, newSessionSchema, parseJsonField } from "./schema";

const session = {
  type: "gym",
  date: "2026-11-30",
  startTime: "18:00",
  durationMin: 45,
  targetRpe: 6,
  gymFocus: "lower",
  expectedIntensity: null,
  notes: null,
};
const parseSession = (x: unknown) => parseJsonField(newSessionSchema, JSON.stringify(x));

describe("newSessionSchema", () => {
  it("gültige Gym-Einheit", () => {
    expect(parseSession(session)).toEqual(session);
  });

  it("Gym braucht Schwerpunkt, andere Typen dürfen keinen haben", () => {
    expect(parseSession({ ...session, gymFocus: null })).toBeNull();
    expect(parseSession({ ...session, type: "mobility" })).toBeNull();
    expect(parseSession({ ...session, type: "mobility", gymFocus: null })).not.toBeNull();
  });

  it("Datum, Uhrzeit, Dauer und RPE werden geprüft", () => {
    expect(parseSession({ ...session, date: "30.11.2026" })).toBeNull();
    expect(parseSession({ ...session, startTime: "25:00" })).toBeNull();
    expect(parseSession({ ...session, startTime: null })).not.toBeNull();
    expect(parseSession({ ...session, durationMin: 2 })).toBeNull();
    expect(parseSession({ ...session, targetRpe: 11 })).toBeNull();
  });

  it("ungültiges JSON", () => {
    expect(parseJsonField(newSessionSchema, "{")).toBeNull();
    expect(parseJsonField(newSessionSchema, undefined)).toBeNull();
  });
});

describe("feedbackSchema", () => {
  const fb = { durationMin: 90, rpe: 7, fatigue: 3, matchMinutes: null, pains: [] };
  const parse = (x: unknown) => parseJsonField(feedbackSchema, JSON.stringify(x));

  it("gültiges Feedback, RPE 0 erlaubt", () => {
    expect(parse(fb)).toEqual(fb);
    expect(parse({ ...fb, rpe: 0 })).not.toBeNull();
  });

  it("Grenzen", () => {
    expect(parse({ ...fb, rpe: 11 })).toBeNull();
    expect(parse({ ...fb, fatigue: 0 })).toBeNull();
    expect(parse({ ...fb, matchMinutes: 200 })).toBeNull();
    expect(parse({ ...fb, durationMin: 0 })).toBeNull();
  });
});
