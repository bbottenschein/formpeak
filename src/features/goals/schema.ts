import { z } from "zod";
import { TEST_KEYS } from "./tests";

export const GOAL_TYPES = ["endurance", "speed", "strength", "muscle_gain", "weight_loss", "prevention", "comeback"] as const;
export const EQUIPMENT_OPTIONS = ["gym", "home", "outdoor", "pitch", "bike"] as const;
export const TIME_BUDGETS = [20, 30, 45, 60, 75, 90] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const goalSchema = z
  .object({
    type: z.enum(GOAL_TYPES),
    description: z.string().trim().min(3).max(500),
    testKey: z.enum(TEST_KEYS).nullable(),
    testName: z.string().trim().max(60).nullable(),
    baselineValue: z.number().finite().nullable(),
    targetValue: z.number().finite().nullable(),
    unit: z.string().trim().max(20).nullable(),
    targetDate: isoDate.nullable(),
    aiSummary: z.string().trim().max(1000).nullable(),
    extraSessionsPerWeek: z.number().int().min(0).max(7),
    timeBudgetMin: z.number().int().min(10).max(240),
    availableWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
    equipment: z.array(z.enum(EQUIPMENT_OPTIONS)),
  })
  // Werte nur zusammen mit einem Test.
  .refine((g) => g.testKey || g.testName || (g.baselineValue == null && g.targetValue == null), { message: "test" })
  // Genau so viele Tage wie Zusatzeinheiten (mindestens einer, auch bei 0 Einheiten egal).
  .refine((g) => g.extraSessionsPerWeek === 0 || g.availableWeekdays.length === g.extraSessionsPerWeek, {
    message: "days",
  });

export type GoalInput = z.infer<typeof goalSchema>;

/** Trainingsmittel nur nötig, wenn es Zusatzeinheiten gibt. */
export const goalSaveSchema = goalSchema.refine((g) => g.extraSessionsPerWeek === 0 || g.equipment.length > 0, {
  message: "equipment",
});

/** Startwerte für das Onboarding; übernimmt einen vorhandenen Trainingsrahmen. */
export function emptyGoal(
  frame: Pick<GoalInput, "extraSessionsPerWeek" | "timeBudgetMin" | "availableWeekdays" | "equipment"> | null,
): GoalInput {
  return {
    type: "endurance",
    description: "",
    testKey: null,
    testName: null,
    aiSummary: null,
    baselineValue: null,
    targetValue: null,
    unit: null,
    targetDate: null,
    extraSessionsPerWeek: frame?.extraSessionsPerWeek ?? 2,
    timeBudgetMin: frame?.timeBudgetMin ?? 60,
    availableWeekdays:
      frame && frame.availableWeekdays.length === frame.extraSessionsPerWeek ? frame.availableWeekdays : [],
    equipment: frame?.equipment ?? [],
  };
}
