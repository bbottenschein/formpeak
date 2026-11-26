import { describe, expect, it } from "vitest";
import { addDays, dateRange, diffDays, mondayOf, weekdayOf } from "./dates";

describe("dates", () => {
  it("addDays über Monats- und Jahresgrenzen", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("addDays ignoriert die Zeitumstellung", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("diffDays", () => {
    expect(diffDays("2026-11-26", "2026-12-05")).toBe(9);
    expect(diffDays("2026-12-05", "2026-11-26")).toBe(-9);
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("weekdayOf und mondayOf", () => {
    expect(weekdayOf("2026-11-26")).toBe(4); // Donnerstag
    expect(mondayOf("2026-11-26")).toBe("2026-11-23");
    expect(mondayOf("2026-11-29")).toBe("2026-11-23"); // Sonntag gehört zur Woche davor
    expect(mondayOf("2026-11-30")).toBe("2026-11-30");
  });

  it("dateRange inklusive", () => {
    expect(dateRange("2026-11-29", "2026-12-01")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
    expect(dateRange("2026-12-01", "2026-11-29")).toEqual([]);
  });
});
