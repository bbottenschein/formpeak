import type { MatchdayContext, SessionType, TrafficLight } from "@/core/load";

/**
 * Kuratierte Routinen für „Heute“ (docs/AENDERUNGEN.md › Heute): eine passende Ergänzung zum Ziel
 * mit Übungen. Später ersetzt die KI die Auswahl; die Regeln (Ampel, Spieltag) bleiben im Code.
 */
export const ROUTINE_KEYS = [
  "mobility_hip_groin",
  "recovery_flush",
  "activation_md1",
  "acceleration",
  "intervals_4x4",
  "easy_run",
  "prevention_core",
  "strength_full",
] as const;
export type RoutineKey = (typeof ROUTINE_KEYS)[number];

export interface RoutineExercise {
  /** Schlüssel für Name und Anleitung in messages (`routines.exercises.*`). */
  key: string;
  /** Dauer in Sekunden oder Wiederholungen als Text-Schlüssel. */
  seconds?: number;
  reps?: string;
}

export interface Routine {
  key: RoutineKey;
  minutes: number;
  /** So wird sie als Einheit eingetragen, wenn man sie erledigt. */
  sessionType: SessionType;
  rpe: number;
  intense: boolean;
  exercises: RoutineExercise[];
  /** Braucht diese Trainingsmittel (leer = überall). */
  needs: string[];
}

export const ROUTINES: Record<RoutineKey, Routine> = {
  mobility_hip_groin: {
    key: "mobility_hip_groin",
    minutes: 10,
    sessionType: "mobility",
    rpe: 2,
    intense: false,
    needs: [],
    exercises: [
      { key: "hip_flexor_stretch", seconds: 60 },
      { key: "adductor_rock", seconds: 60 },
      { key: "ninety_ninety", seconds: 90 },
      { key: "worlds_greatest", reps: "5_per_side" },
      { key: "glute_bridge", reps: "12" },
      { key: "calf_stretch", seconds: 60 },
    ],
  },
  recovery_flush: {
    key: "recovery_flush",
    minutes: 25,
    sessionType: "recovery",
    rpe: 2,
    intense: false,
    needs: [],
    exercises: [
      { key: "easy_bike_or_walk", seconds: 900 },
      { key: "hip_flexor_stretch", seconds: 60 },
      { key: "hamstring_floss", seconds: 60 },
      { key: "adductor_rock", seconds: 60 },
      { key: "breathing", seconds: 120 },
    ],
  },
  activation_md1: {
    key: "activation_md1",
    minutes: 15,
    sessionType: "mobility",
    rpe: 3,
    intense: false,
    needs: [],
    exercises: [
      { key: "leg_swings", reps: "10_per_side" },
      { key: "worlds_greatest", reps: "3_per_side" },
      { key: "pogo_jumps", reps: "2x10" },
      { key: "strides", reps: "3x20m" },
      { key: "short_sprints", reps: "3x10m" },
    ],
  },
  acceleration: {
    key: "acceleration",
    minutes: 25,
    sessionType: "run_intervals",
    rpe: 7,
    intense: true,
    needs: ["pitch"],
    exercises: [
      { key: "warmup_jog", seconds: 480 },
      { key: "a_skips", reps: "2x15m" },
      { key: "short_sprints", reps: "6x10m" },
      { key: "flying_sprints", reps: "3x20m" },
      { key: "easy_jog", seconds: 300 },
    ],
  },
  intervals_4x4: {
    key: "intervals_4x4",
    minutes: 35,
    sessionType: "run_intervals",
    rpe: 8,
    intense: true,
    needs: ["outdoor"],
    exercises: [
      { key: "warmup_jog", seconds: 600 },
      { key: "interval_4min", reps: "4x" },
      { key: "easy_jog", seconds: 300 },
    ],
  },
  easy_run: {
    key: "easy_run",
    minutes: 30,
    sessionType: "run_intervals",
    rpe: 4,
    intense: false,
    needs: ["outdoor"],
    exercises: [{ key: "easy_run_30", seconds: 1800 }],
  },
  prevention_core: {
    key: "prevention_core",
    minutes: 15,
    sessionType: "mobility",
    rpe: 5,
    intense: false,
    needs: [],
    exercises: [
      { key: "nordic_curl", reps: "3x5" },
      { key: "copenhagen_plank", reps: "3x20s_per_side" },
      { key: "single_leg_balance", reps: "3x30s_per_side" },
      { key: "side_plank", reps: "2x30s_per_side" },
      { key: "calf_raise_single", reps: "2x12_per_side" },
    ],
  },
  strength_full: {
    key: "strength_full",
    minutes: 45,
    sessionType: "gym",
    rpe: 7,
    intense: true,
    needs: ["gym"],
    exercises: [
      { key: "squat", reps: "4x5" },
      { key: "rdl", reps: "3x6" },
      { key: "split_squat", reps: "3x8_per_side" },
      { key: "pull_up_row", reps: "3x8" },
      { key: "nordic_curl", reps: "3x5" },
    ],
  },
};

/** Ziel → bevorzugte Routine an einem freien, grünen Tag. */
const GOAL_ROUTINE: Record<string, RoutineKey> = {
  endurance: "intervals_4x4",
  speed: "acceleration",
  strength: "strength_full",
  muscle_gain: "strength_full",
  weight_loss: "easy_run",
  prevention: "prevention_core",
  comeback: "prevention_core",
};

export interface RoutineContext {
  goalType: string | null;
  light: TrafficLight;
  md: MatchdayContext;
  /** Heute schon Teamtraining oder Spiel. */
  hasFixtureToday: boolean;
  equipment: string[];
}

/**
 * Eine passende Ergänzung für heute. Regeln zuerst (Ampel, Spieltag), dann das Ziel:
 * - Spieltag → Aktivierung nur, wenn das Spiel noch kommt; sonst keine Ergänzung.
 * - MD+1 oder Ampel rot → Regeneration.
 * - MD−1 → Aktivierung.
 * - Ampel gelb oder Fußball heute → 10 min Mobilität nach dem Training.
 * - Sonst die Zielroutine, falls die Trainingsmittel passen, sonst Prävention/Mobilität.
 */
export function suggestRoutine(ctx: RoutineContext): Routine | null {
  const { light, md } = ctx;
  if (md.daysToNext === 0) return null;
  if (md.daysSinceLast === 1 || light === "red") return ROUTINES.recovery_flush;
  if (md.daysToNext === 1) return ROUTINES.activation_md1;
  if (light === "yellow" || ctx.hasFixtureToday || light === "grey") return ROUTINES.mobility_hip_groin;

  const preferred = ctx.goalType ? GOAL_ROUTINE[ctx.goalType] : null;
  const fits = (r: Routine) => r.needs.every((n) => ctx.equipment.includes(n));
  // Intensives Training nicht 2 Tage vor dem Spiel (Unterkörper-/Intervallregel).
  const closeToMatch = md.daysToNext != null && md.daysToNext <= 2;
  if (preferred) {
    const routine = ROUTINES[preferred];
    if (fits(routine) && !(routine.intense && closeToMatch)) return routine;
  }
  return ROUTINES.prevention_core;
}
