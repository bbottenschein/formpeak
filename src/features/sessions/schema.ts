import { z } from "zod";
import { painEntrySchema } from "@/features/checkin/schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

/** Neue Einheit: selbst geplant (Gym, Lauf …) oder Einzeltermin (Training/Spiel ohne Serie). */
export const newSessionSchema = z
  .object({
    type: z.enum(["training", "match", "gym", "run_intervals", "mobility", "recovery"]),
    date: isoDate,
    startTime: time,
    durationMin: z.number().int().min(5).max(300),
    targetRpe: z.number().int().min(0).max(10).nullable(),
    gymFocus: z.enum(["lower", "upper", "full"]).nullable(),
    expectedIntensity: z.enum(["low", "medium", "high"]).nullable(),
    notes: z.string().max(500).nullable(),
  })
  .refine((s) => s.type === "gym" || s.gymFocus == null, { message: "gymFocus" })
  .refine((s) => s.type !== "gym" || s.gymFocus != null, { message: "gymFocusRequired" });

export type NewSessionInput = z.infer<typeof newSessionSchema>;

/** Feedback nach einer Einheit (gilt für Fußball und Zusatzeinheiten). */
export const feedbackSchema = z
  .object({
    durationMin: z.number().int().min(1).max(300),
    rpe: z.number().int().min(0).max(10),
    fatigue: z.number().int().min(1).max(5),
    matchMinutes: z.number().int().min(0).max(150).nullable(),
    pains: z.array(painEntrySchema).max(20),
  })
  .refine(
    (c) => new Set(c.pains.map((p) => `${p.region}|${p.side}`)).size === c.pains.length,
    { message: "duplicate" },
  );

export type FeedbackInput = z.infer<typeof feedbackSchema>;

/** JSON aus einem Formularfeld mit einem Schema prüfen. Liefert null bei ungültigen Daten. */
export function parseJsonField<T>(schema: z.ZodType<T>, raw: unknown): T | null {
  if (typeof raw !== "string") return null;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
