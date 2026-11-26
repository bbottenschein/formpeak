import type { IsoDate } from "./dates";

export type SessionType =
  | "training"
  | "match"
  | "gym"
  | "run_intervals"
  | "mobility"
  | "recovery";

export type SessionStatus = "planned" | "done" | "cancelled";

/** Gym-Schwerpunkt, wichtig für die Regel zum Unterkörper-Krafttraining. */
export type GymFocus = "lower" | "upper" | "full";

export type ExpectedIntensity = "low" | "medium" | "high";

export interface Session {
  id: string;
  date: IsoDate;
  type: SessionType;
  status: SessionStatus;
  durationMin: number;
  /** Tatsächlicher RPE (0–10) aus dem Feedback. */
  rpe: number | null;
  /** Geplanter Ziel-RPE (selbst geplante Einheiten). */
  targetRpe?: number | null;
  /** Standard-RPE der Serie bzw. des Einheitstyps, falls kein RPE eingetragen ist. */
  defaultRpe: number;
  /** Fester Fußballtermin aus dem Kalender. */
  isFixture: boolean;
  expectedIntensity?: ExpectedIntensity | null;
  gymFocus?: GymFocus | null;
}

export type TrafficLight = "grey" | "green" | "yellow" | "red";

export type BodySide = "left" | "right" | "center";

export type PainKind = "muscle" | "joint" | "tendon" | "unclear";

export const BODY_REGIONS = [
  "head_neck",
  "shoulder",
  "chest",
  "abdomen",
  "upper_back",
  "lower_back",
  "elbow_upper_arm",
  "wrist_hand",
  "hip",
  "groin",
  "adductors",
  "glutes",
  "thigh_front",
  "thigh_back",
  "knee",
  "shin",
  "calf",
  "achilles",
  "ankle",
  "foot_heel",
] as const;

export type BodyRegion = (typeof BODY_REGIONS)[number];

export interface PainEntry {
  date: IsoDate;
  region: BodyRegion;
  side: BodySide;
  intensity: number;
  kind: PainKind;
  swollen: boolean;
}

export interface MorningCheckin {
  date: IsoDate;
  sleepHours: number;
  sleepQuality: number;
  energy: number;
  soreness: number;
  stress: number;
  /** Ruhepuls in Schlägen/min (10-s-Zählung × 6), optional. */
  restingHr: number | null;
}
