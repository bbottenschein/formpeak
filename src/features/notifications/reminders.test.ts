import { describe, expect, it } from "vitest";
import { dueReminders, inWindow, type ReminderProfile, type ReminderState } from "./reminders";

const profile: ReminderProfile = {
  morningReminder: "07:30:00",
  eveningReminder: "21:00:00",
  pushMorning: true,
  pushEvening: true,
};
const state = (extra: Partial<ReminderState> = {}): ReminderState => ({
  localTime: "07:45",
  morningDone: false,
  eveningDone: false,
  alreadySent: new Set(),
  ...extra,
});

describe("inWindow", () => {
  it("ab der Uhrzeit drei Stunden lang", () => {
    expect(inWindow("07:29", "07:30")).toBe(false);
    expect(inWindow("07:30", "07:30")).toBe(true);
    expect(inWindow("10:29", "07:30")).toBe(true);
    expect(inWindow("10:30", "07:30")).toBe(false);
  });

  it("kein Übergang über Mitternacht", () => {
    expect(inWindow("00:30", "23:00")).toBe(false);
    expect(inWindow("23:30", "23:00")).toBe(true);
  });
});

describe("dueReminders", () => {
  it("Morgen fällig im Fenster", () => {
    expect(dueReminders(profile, state())).toEqual(["morning"]);
  });

  it("nicht, wenn schon eingecheckt, schon gesendet oder abgeschaltet", () => {
    expect(dueReminders(profile, state({ morningDone: true }))).toEqual([]);
    expect(dueReminders(profile, state({ alreadySent: new Set(["morning"]) }))).toEqual([]);
    expect(dueReminders({ ...profile, pushMorning: false }, state())).toEqual([]);
  });

  it("Abend fällig ab der Abendzeit", () => {
    expect(dueReminders(profile, state({ localTime: "21:10", morningDone: true }))).toEqual(["evening"]);
    expect(dueReminders(profile, state({ localTime: "20:59", morningDone: true }))).toEqual([]);
    expect(dueReminders(profile, state({ localTime: "21:10", eveningDone: true, morningDone: true }))).toEqual([]);
  });

  it("vor der Morgenzeit nichts", () => {
    expect(dueReminders(profile, state({ localTime: "06:00" }))).toEqual([]);
  });
});
