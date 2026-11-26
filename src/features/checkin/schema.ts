import { z } from "zod";
import { BODY_REGIONS } from "@/core/load";
import { sidesFor } from "@/features/bodymap/regions";

const scale = z.number().int().min(1).max(5);

export const painEntrySchema = z
  .object({
    region: z.enum(BODY_REGIONS),
    side: z.enum(["left", "right", "center"]),
    intensity: z.number().int().min(1).max(10),
    kind: z.enum(["muscle", "joint", "tendon", "unclear"]),
    swollen: z.boolean(),
  })
  .refine((p) => sidesFor(p.region).includes(p.side), { message: "side" });

export const morningCheckinSchema = z
  .object({
    sleepHours: z.number().min(0).max(16).multipleOf(0.5),
    sleepQuality: scale,
    energy: scale,
    soreness: scale,
    stress: scale,
    /** 10-Sekunden-Zählung × 6; null = nicht gemessen. */
    restingHr: z.number().int().min(24).max(240).nullable(),
    pains: z.array(painEntrySchema).max(20),
  })
  .refine(
    (c) => new Set(c.pains.map((p) => `${p.region}|${p.side}`)).size === c.pains.length,
    { message: "duplicate" },
  );

export type MorningCheckinInput = z.infer<typeof morningCheckinSchema>;
export type PainInput = z.infer<typeof painEntrySchema>;

/** Standardwerte für den allerersten Check-in. */
export const EMPTY_MORNING: MorningCheckinInput = {
  sleepHours: 7.5,
  sleepQuality: 3,
  energy: 3,
  soreness: 2,
  stress: 2,
  restingHr: null,
  pains: [],
};

/** Liest das JSON aus dem Formular. Liefert null bei ungültigen Daten. */
export function parseMorningPayload(raw: unknown): MorningCheckinInput | null {
  if (typeof raw !== "string") return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = morningCheckinSchema.safeParse(json);
  return result.success ? result.data : null;
}

const eveningScale = z.number().int().min(1).max(5);

export const eveningCheckinSchema = z.object({
  dailyLoad: eveningScale,
  stress: eveningScale,
  energy: eveningScale,
  steps: z.number().int().min(0).max(200_000).nullable(),
  note: z.string().trim().max(500).nullable(),
});

export type EveningCheckinInput = z.infer<typeof eveningCheckinSchema>;

export const EMPTY_EVENING: EveningCheckinInput = {
  dailyLoad: 3,
  stress: 2,
  energy: 3,
  steps: null,
  note: null,
};

export function parseEveningPayload(raw: unknown): EveningCheckinInput | null {
  if (typeof raw !== "string") return null;
  try {
    const result = eveningCheckinSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
