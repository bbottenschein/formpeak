import { LOAD_CONFIG, type LoadConfig } from "./config";
import type { PainSpotStatus } from "./pain";
import type { TrafficLight } from "./types";

export type LightReason =
  | { code: "no_checkin" }
  | { code: "readiness_low"; readiness: number }
  | { code: "readiness_medium"; readiness: number }
  | { code: "acwr_spike"; acwr: number }
  | { code: "acwr_elevated"; acwr: number }
  | { code: "pain_red"; spots: PainSpotStatus[] }
  | { code: "all_good" };

export interface LightInput {
  /** null = heute noch kein Morgen-Check-in. */
  readiness: number | null;
  /** null = ACWR noch nicht aussagekräftig (Kalibrierung). */
  acwr: number | null;
  painSpots: PainSpotStatus[];
}

export interface LightResult {
  light: TrafficLight;
  reasons: LightReason[];
}

/** Tagesampel (SPEC 4.4). Gibt alle zutreffenden Gründe der gewählten Farbe zurück. */
export function computeTrafficLight(
  input: LightInput,
  config: LoadConfig = LOAD_CONFIG,
): LightResult {
  const { readiness, acwr, painSpots } = input;
  const r = config.readiness;
  const a = config.acwr;

  if (readiness == null) return { light: "grey", reasons: [{ code: "no_checkin" }] };

  const red: LightReason[] = [];
  if (readiness < r.yellow) red.push({ code: "readiness_low", readiness });
  if (acwr != null && acwr > a.yellow) red.push({ code: "acwr_spike", acwr });
  const redSpots = painSpots.filter((s) => s.level === "red");
  if (redSpots.length > 0) red.push({ code: "pain_red", spots: redSpots });
  if (red.length > 0) return { light: "red", reasons: red };

  const yellow: LightReason[] = [];
  if (readiness < r.green) yellow.push({ code: "readiness_medium", readiness });
  if (acwr != null && acwr > a.green) yellow.push({ code: "acwr_elevated", acwr });
  if (yellow.length > 0) return { light: "yellow", reasons: yellow };

  return { light: "green", reasons: [{ code: "all_good" }] };
}
