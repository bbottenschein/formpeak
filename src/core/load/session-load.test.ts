import { describe, expect, it } from "vitest";
import { dailyLoads, plannedLoad, sessionLoad } from "./session-load";
import { match, session, training } from "./test-helpers";

const TODAY = "2026-11-26";

describe("sessionLoad (sRPE)", () => {
  it("RPE × Dauer: 90 min mit RPE 7 = 630 AU", () => {
    expect(sessionLoad(session({ date: TODAY, rpe: 7, durationMin: 90 }), TODAY)).toEqual({
      load: 630,
      estimated: false,
      counts: true,
    });
  });

  it("RPE 0 ergibt 0 AU, ist aber nicht geschätzt", () => {
    expect(sessionLoad(session({ date: TODAY, rpe: 0 }), TODAY)).toEqual({
      load: 0,
      estimated: false,
      counts: true,
    });
  });

  it("absolviert ohne RPE → Standard-RPE, als geschätzt markiert", () => {
    const s = session({ date: TODAY, rpe: null, defaultRpe: 6, durationMin: 90 });
    expect(sessionLoad(s, TODAY)).toEqual({ load: 540, estimated: true, counts: true });
  });

  it("ausgefallen zählt 0", () => {
    const s = session({ date: TODAY, status: "cancelled", rpe: 8 });
    expect(sessionLoad(s, TODAY)).toEqual({ load: 0, estimated: false, counts: false });
  });

  it("vergangener Fußballtermin ohne Feedback gilt als absolviert (geschätzt)", () => {
    const t = training("2026-11-24"); // 90 min, Standard-RPE 6
    expect(sessionLoad(t, TODAY)).toEqual({ load: 540, estimated: true, counts: true });
  });

  it("heutiger oder künftiger Fußballtermin ohne Feedback zählt noch nicht", () => {
    expect(sessionLoad(training(TODAY), TODAY).counts).toBe(false);
    expect(sessionLoad(match("2026-11-28"), TODAY).counts).toBe(false);
  });

  it("selbst geplante Einheit zählt erst, wenn absolviert – auch in der Vergangenheit", () => {
    const s = session({ date: "2026-11-20", status: "planned", rpe: null });
    expect(sessionLoad(s, TODAY).counts).toBe(false);
  });

  it("geplanter Status ignoriert einen versehentlich gesetzten RPE nicht bei Fixtures", () => {
    // Ein geplanter, vergangener Fixture-Termin nutzt den Standard-RPE, nicht einen evtl. vorbelegten Wert.
    const t = training("2026-11-24", { rpe: 9 });
    expect(sessionLoad(t, TODAY)).toEqual({ load: 540, estimated: true, counts: true });
  });
});

describe("plannedLoad", () => {
  it("nutzt Ziel-RPE, sonst Standard-RPE", () => {
    expect(plannedLoad(session({ date: TODAY, status: "planned", targetRpe: 7, durationMin: 40 }))).toBe(280);
    expect(plannedLoad(session({ date: TODAY, status: "planned", defaultRpe: 4, durationMin: 30 }))).toBe(120);
  });

  it("absolvierte Einheit mit RPE nutzt den echten Wert, ausgefallene zählt 0", () => {
    expect(plannedLoad(session({ date: TODAY, rpe: 8, targetRpe: 5, durationMin: 10 }))).toBe(80);
    expect(plannedLoad(session({ date: TODAY, status: "cancelled" }))).toBe(0);
  });
});

describe("dailyLoads", () => {
  it("summiert pro Tag und lässt nicht zählende Einheiten weg", () => {
    const loads = dailyLoads(
      [
        session({ date: "2026-11-25", rpe: 5, durationMin: 60 }),
        session({ date: "2026-11-25", rpe: 3, durationMin: 20 }),
        session({ date: "2026-11-24", status: "cancelled" }),
        session({ date: TODAY, status: "planned" }),
      ],
      TODAY,
    );
    expect(loads.get("2026-11-25")).toBe(360);
    expect(loads.has("2026-11-24")).toBe(false);
    expect(loads.has(TODAY)).toBe(false);
  });
});
