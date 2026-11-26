import { z } from "zod";

export const GOAL_TYPES = ["endurance", "speed", "strength", "prevention", "comeback"] as const;
export const EQUIPMENT_OPTIONS = ["gym", "home", "outdoor", "pitch", "bike"] as const;
export const TIME_BUDGETS = [20, 30, 45, 60, 75, 90] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const goalSchema = z
  .object({
    type: z.enum(GOAL_TYPES),
    description: z.string().trim().min(3).max(500),
    testName: z.string().trim().max(60).nullable(),
    baselineValue: z.number().finite().nullable(),
    targetValue: z.number().finite().nullable(),
    unit: z.string().trim().max(20).nullable(),
    targetDate: isoDate.nullable(),
    extraSessionsPerWeek: z.number().int().min(0).max(7),
    timeBudgetMin: z.number().int().min(10).max(240),
    availableWeekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    equipment: z.array(z.enum(EQUIPMENT_OPTIONS)).min(1),
  })
  // Werte nur zusammen mit einem Testnamen.
  .refine((g) => g.testName || (g.baselineValue == null && g.targetValue == null), { message: "test" });

export type GoalInput = z.infer<typeof goalSchema>;

/** Vorgaben für bekannte Tests (Einheit und ob kleiner besser ist). */
export const TEST_PRESETS = {
  yoyo: { unit: "m", lowerIsBetter: false },
  run3k: { unit: "min", lowerIsBetter: true },
  sprint30: { unit: "s", lowerIsBetter: true },
} as const;
