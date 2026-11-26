import { describe, expect, it } from "vitest";
import { formatLongDate, isValidTimeZone, userToday, zonedParts, zonedToUtc } from "./date";

describe("Datum in Nutzer-Zeitzone", () => {
  it("Tagesgrenze hängt von der Zeitzone ab", () => {
    const at = new Date("2026-11-26T23:30:00Z");
    expect(userToday("Europe/Berlin", at)).toBe("2026-11-27");
    expect(userToday("Europe/London", at)).toBe("2026-11-26");
    expect(userToday("America/New_York", at)).toBe("2026-11-26");
  });

  it("zonedParts liefert lokale Stunde", () => {
    expect(zonedParts(new Date("2026-07-01T06:15:00Z"), "Europe/Berlin")).toEqual({
      date: "2026-07-01",
      time: "08:15",
      hour: 8,
    });
  });

  it("zonedToUtc berücksichtigt Sommer- und Winterzeit", () => {
    expect(zonedToUtc("2026-11-28", "15:00", "Europe/Berlin").toISOString()).toBe("2026-11-28T14:00:00.000Z");
    expect(zonedToUtc("2026-07-04", "15:00", "Europe/Berlin").toISOString()).toBe("2026-07-04T13:00:00.000Z");
    expect(zonedToUtc("2026-03-29", "12:00", "Europe/Berlin").toISOString()).toBe("2026-03-29T10:00:00.000Z");
    expect(zonedToUtc("2026-11-28", "15:00", "America/New_York").toISOString()).toBe("2026-11-28T20:00:00.000Z");
  });

  it("isValidTimeZone", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });

  it("formatLongDate", () => {
    expect(formatLongDate("2026-11-26")).toBe("Donnerstag, 26. November");
  });
});
