/**
 * Wissenschaftliche Grundlagen, auf die sich vorgeschlagene Einheiten stützen dürfen.
 * Die KI wählt nur Schlüssel aus dieser Liste – Texte und Quellen stehen in `messages`
 * (`basis.*`) und sind von Hand geprüft. So kann die KI keine Studien erfinden.
 */
export const BASIS_KEYS = [
  "strength_speed",
  "hypertrophy_volume",
  "hiit_4x4",
  "aerobic_base",
  "sprint_exposure",
  "nordic",
  "copenhagen",
  "warmup_11plus",
  "load_progression",
  "deload",
  "detraining",
  "recovery_light",
] as const;

export type BasisKey = (typeof BASIS_KEYS)[number];

export const isBasisKey = (k: string): k is BasisKey => (BASIS_KEYS as readonly string[]).includes(k);
