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

export interface FeedbackCandidate {
  id: string;
  date: string;
  /** "HH:mm" oder "HH:mm:ss", null = ohne Uhrzeit. */
  startTime: string | null;
  durationMin: number;
  status: "planned" | "done" | "cancelled";
}

/** So lange nach dem Ende einer Einheit kommt die Feedback-Erinnerung. */
export const FEEDBACK_DELAY_MIN = 120;
/** Einheiten ohne Uhrzeit gelten als um diese Zeit beendet. */
export const FEEDBACK_DEFAULT_END = "20:00";

/**
 * Einheiten von heute, für die jetzt eine Feedback-Erinnerung fällig ist:
 * noch geplant (kein Feedback), Ende + 2 h erreicht, noch nicht erinnert.
 */
export function dueFeedback(
  sessions: FeedbackCandidate[],
  localDate: string,
  localTime: string,
  alreadySent: Set<string>,
): FeedbackCandidate[] {
  const now = minutes(localTime);
  return sessions.filter((s) => {
    if (s.date !== localDate || s.status !== "planned" || alreadySent.has(s.id)) return false;
    const end = s.startTime ? minutes(s.startTime) + s.durationMin : minutes(FEEDBACK_DEFAULT_END);
    return now >= end + (s.startTime ? FEEDBACK_DELAY_MIN : 0);
  });
}
