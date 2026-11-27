import { describe, expect, it } from "vitest";
import { dueFeedback, dueReminders, inWindow, todayLine, type ReminderProfile, type ReminderState } from "./reminders";

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

describe("dueFeedback", () => {
  const training = { id: "t", date: "2026-11-26", startTime: "19:00:00", durationMin: 90, status: "planned" as const };

  it("2 Stunden nach dem Ende fällig, vorher nicht", () => {
    expect(dueFeedback([training], "2026-11-26", "22:29", new Set())).toEqual([]);
    expect(dueFeedback([training], "2026-11-26", "22:30", new Set())).toEqual([training]);
  });

  it("nicht bei Feedback, Absage, anderem Tag oder schon erinnert", () => {
    expect(dueFeedback([{ ...training, status: "done" }], "2026-11-26", "23:00", new Set())).toEqual([]);
    expect(dueFeedback([{ ...training, status: "cancelled" }], "2026-11-26", "23:00", new Set())).toEqual([]);
    expect(dueFeedback([training], "2026-11-27", "23:00", new Set())).toEqual([]);
    expect(dueFeedback([training], "2026-11-26", "23:00", new Set(["t"]))).toEqual([]);
  });

  it("ohne Uhrzeit ab 20:00", () => {
    const gym = { ...training, id: "g", startTime: null, durationMin: 45 };
    expect(dueFeedback([gym], "2026-11-26", "19:59", new Set())).toEqual([]);
    expect(dueFeedback([gym], "2026-11-26", "20:00", new Set())).toEqual([gym]);
  });
});

describe("todayLine", () => {
  const label = (t: string) => ({ training: "Teamtraining", gym: "Gym" })[t] ?? t;
  it("Termine mit Uhrzeit zuerst, Vorschläge mit Dauer, höchstens zwei", () => {
    expect(
      todayLine(
        [
          { type: "gym", title: "Kraft Unterkörper", durationMin: 50, startTime: null },
          { type: "training", title: null, durationMin: 90, startTime: "19:00:00" },
          { type: "mobility", title: "Mobilität", durationMin: 15, startTime: null },
        ],
        label,
      ),
    ).toEqual([
      { label: "Teamtraining", detail: "19:00" },
      { label: "Kraft Unterkörper", detail: "50 min" },
    ]);
  });
  it("leer bei Ruhetag", () => {
    expect(todayLine([], label)).toEqual([]);
  });
});
