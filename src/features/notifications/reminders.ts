/** Reine Logik der Check-in-Erinnerungen (getestet in reminders.test.ts). */

export type ReminderKind = "morning" | "evening";

/** So lange nach der eingestellten Uhrzeit wird noch erinnert (falls ein Job ausfällt). */
export const REMINDER_WINDOW_MIN = 180;

export interface ReminderProfile {
  morningReminder: string; // "07:30" oder "07:30:00"
  eveningReminder: string;
  pushMorning: boolean;
  pushEvening: boolean;
}

export interface ReminderState {
  /** Lokale Uhrzeit des Nutzers, "HH:mm". */
  localTime: string;
  morningDone: boolean;
  eveningDone: boolean;
  /** Heute schon verschickte Erinnerungen. */
  alreadySent: Set<ReminderKind>;
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Liegt `now` im Fenster [Erinnerungszeit, Erinnerungszeit + 3 h)? Kein Übergang über Mitternacht. */
export function inWindow(now: string, reminder: string, windowMin = REMINDER_WINDOW_MIN): boolean {
  const n = minutes(now);
  const r = minutes(reminder);
  return n >= r && n < r + windowMin;
}

/** Welche Erinnerungen jetzt fällig sind. Jede höchstens einmal pro Tag, nie wenn schon eingecheckt. */
export function dueReminders(profile: ReminderProfile, state: ReminderState): ReminderKind[] {
  const due: ReminderKind[] = [];
  if (
    profile.pushMorning &&
    !state.morningDone &&
    !state.alreadySent.has("morning") &&
    inWindow(state.localTime, profile.morningReminder)
  ) {
    due.push("morning");
  }
  if (
    profile.pushEvening &&
    !state.eveningDone &&
    !state.alreadySent.has("evening") &&
    inWindow(state.localTime, profile.eveningReminder)
  ) {
    due.push("evening");
  }
  return due;
}
