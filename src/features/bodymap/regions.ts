import type { BodyRegion, BodySide, PainKind } from "@/core/load";

/** Gruppen von oben nach unten – so tippt man sich schnell zur richtigen Stelle. */
export const REGION_GROUPS: { key: "head" | "trunk" | "hip" | "thigh" | "lower"; regions: BodyRegion[] }[] = [
  { key: "head", regions: ["head_neck", "shoulder", "elbow_upper_arm", "wrist_hand", "chest"] },
  { key: "trunk", regions: ["abdomen", "upper_back", "lower_back"] },
  { key: "hip", regions: ["hip", "groin", "adductors", "glutes"] },
  { key: "thigh", regions: ["thigh_front", "thigh_back", "knee"] },
  { key: "lower", regions: ["shin", "calf", "achilles", "ankle", "foot_heel"] },
];

/** Regionen ohne linke/rechte Seite. */
const CENTER_REGIONS = new Set<BodyRegion>(["chest", "abdomen", "upper_back", "lower_back"]);

export function sidesFor(region: BodyRegion): BodySide[] {
  return CENTER_REGIONS.has(region) ? ["center"] : ["left", "right"];
}

/** Vorschlag für die Art, damit meist nur ein Tipp nötig ist. */
export function defaultKindFor(region: BodyRegion): PainKind {
  if (region === "achilles") return "tendon";
  if (region === "knee" || region === "ankle" || region === "hip" || region === "wrist_hand") return "joint";
  return "muscle";
}

export const PAIN_KINDS: PainKind[] = ["muscle", "joint", "tendon", "unclear"];

/** Schwellung ist nur bei Gelenk und Sehne für die Regeln relevant. */
export function swellingRelevant(kind: PainKind): boolean {
  return kind === "joint" || kind === "tendon";
}
