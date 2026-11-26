import type { MorningCheckin, PainEntry, Session } from "./types";

let counter = 0;

/** Testeinheit mit sinnvollen Standardwerten. */
export function session(partial: Partial<Session> & Pick<Session, "date">): Session {
  return {
    id: `s${++counter}`,
    type: "gym",
    status: "done",
    durationMin: 60,
    rpe: 5,
    defaultRpe: 5,
    isFixture: false,
    ...partial,
  };
}

export function training(date: string, extra: Partial<Session> = {}): Session {
  return session({
    date,
    type: "training",
    status: "planned",
    durationMin: 90,
    rpe: null,
    defaultRpe: 6,
    isFixture: true,
    expectedIntensity: "medium",
    ...extra,
  });
}

export function match(date: string, extra: Partial<Session> = {}): Session {
  return session({
    date,
    type: "match",
    status: "planned",
    durationMin: 90,
    rpe: null,
    defaultRpe: 8,
    isFixture: true,
    ...extra,
  });
}

export function checkin(partial: Partial<MorningCheckin> & Pick<MorningCheckin, "date">): MorningCheckin {
  return {
    sleepHours: 8,
    sleepQuality: 5,
    energy: 5,
    soreness: 1,
    stress: 1,
    restingHr: null,
    ...partial,
  };
}

export function pain(partial: Partial<PainEntry> & Pick<PainEntry, "date">): PainEntry {
  return {
    region: "knee",
    side: "left",
    intensity: 2,
    kind: "muscle",
    swollen: false,
    ...partial,
  };
}
