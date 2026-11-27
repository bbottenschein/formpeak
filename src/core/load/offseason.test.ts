import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { inOffseason, offseasonWeek, returnWeeks } from "./offseason";

// Pause ab Sa 28.11.2026, Vorbereitung ab Mo 11.01.2027 → letzter Pausentag So 10.01.
const phase = { startsOn: "2026-11-28", endsOn: "2027-01-10", recoveryWeeks: 1 };

describe("offseasonWeek", () => {
  it("Woche 1 = Woche des Starts (auch mitten in der Woche)", () => {
    expect(offseasonWeek(phase, "2026-11-28")).toMatchObject({ week: 1, totalWeeks: 7, block: "recover" });
    expect(offseasonWeek(phase, "2026-11-29").week).toBe(1);
    expect(offseasonWeek(phase, "2026-11-30").week).toBe(2);
  });

  it("Erholen → Aufbauen → Zurück zum Fußball (7 Wochen, 1 Erholung → 3 Wochen Rückführung)", () => {
    const blocks = ["2026-11-28", "2026-11-30", "2026-12-07", "2026-12-14", "2026-12-21", "2026-12-28", "2027-01-04"].map(
      (d) => offseasonWeek(phase, d).block,
    );
    expect(blocks).toEqual(["recover", "build", "build", "build", "return", "return", "return"]);
  });

  it("Entlastung in jeder 4. Aufbauwoche", () => {
    const open = { startsOn: "2026-11-30", endsOn: null, recoveryWeeks: 0 };
    const deloads = [0, 1, 2, 3, 4, 5, 6, 7].map((w) => offseasonWeek(open, addDays("2026-11-30", w * 7)).deload);
    expect(deloads).toEqual([false, false, false, true, false, false, false, true]);
  });

  it("Ende offen: kein Rückführungsabschnitt, keine Restwochen", () => {
    const open = { ...phase, endsOn: null };
    expect(offseasonWeek(open, "2027-01-04")).toMatchObject({ block: "build", totalWeeks: null, weeksToPreseason: null });
  });

  it("Wochen bis zur Vorbereitung", () => {
    expect(offseasonWeek(phase, "2026-12-28").weeksToPreseason).toBe(2);
    expect(offseasonWeek(phase, "2027-01-04").weeksToPreseason).toBe(1);
  });

  it("ohne Erholung startet direkt der Aufbau", () => {
    expect(offseasonWeek({ ...phase, recoveryWeeks: 0 }, "2026-11-28").block).toBe("build");
  });
});

describe("returnWeeks – Grenzen", () => {
  it("6+ Wochen nach der Erholung → 3, 4–5 → 2, 2–3 → 1, darunter 0", () => {
    expect(returnWeeks(7, 1)).toBe(3);
    expect(returnWeeks(6, 1)).toBe(2);
    expect(returnWeeks(5, 1)).toBe(2);
    expect(returnWeeks(3, 0)).toBe(1);
    expect(returnWeeks(2, 1)).toBe(0);
    expect(returnWeeks(null, 1)).toBe(0);
  });
});

describe("inOffseason", () => {
  it("Start und letzter Tag gehören dazu", () => {
    expect(inOffseason(phase, "2026-11-27")).toBe(false);
    expect(inOffseason(phase, "2026-11-28")).toBe(true);
    expect(inOffseason(phase, "2027-01-10")).toBe(true);
    expect(inOffseason(phase, "2027-01-11")).toBe(false);
    expect(inOffseason({ ...phase, endsOn: null }, "2028-01-01")).toBe(true);
  });
});
