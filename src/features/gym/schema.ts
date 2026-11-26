import { z } from "zod";

export const MUSCLE_GROUPS = [
  "legs",
  "posterior_chain",
  "adductors",
  "calves",
  "core",
  "chest",
  "back",
  "shoulders",
  "arms",
  "full_body",
] as const;
export const EQUIPMENT = ["barbell", "dumbbell", "kettlebell", "machine", "cable", "band", "bodyweight", "other"] as const;

export const gymSetSchema = z.object({
  weightKg: z.number().min(0).max(500).multipleOf(0.5),
  reps: z.number().int().min(0).max(200),
  rir: z.number().int().min(0).max(4).nullable(),
  setType: z.enum(["warmup", "working"]),
});

export const gymLogSchema = z.object({
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().uuid(),
        note: z.string().trim().max(300).nullable(),
        sets: z.array(gymSetSchema).max(15),
      }),
    )
    .max(20),
});

export type GymLogInput = z.infer<typeof gymLogSchema>;

export const customExerciseSchema = z.object({
  name: z.string().trim().min(2).max(60),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  equipment: z.enum(EQUIPMENT),
});
