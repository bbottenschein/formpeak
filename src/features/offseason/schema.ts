import { z } from "zod";
import { EQUIPMENT_OPTIONS } from "@/features/goals/schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Eingaben des Off-Season-Assistenten (alles vom Nutzer gewählt). */
export const offseasonSchema = z
  .object({
    /** Erster Tag der Vorbereitung; null = noch offen. */
    preseasonStart: isoDate.nullable(),
    recoveryWeeks: z.number().int().min(0).max(2),
    extraSessionsPerWeek: z.number().int().min(1).max(6),
    availableWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
    timeBudgetMin: z.number().int().min(10).max(240),
    equipment: z.array(z.enum(EQUIPMENT_OPTIONS)),
  })
  .refine((o) => o.availableWeekdays.length === o.extraSessionsPerWeek, { message: "days" });

export type OffseasonInput = z.infer<typeof offseasonSchema>;
