import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { bestE1rms, lastPerformances, listExercises } from "@/features/gym/queries";
import { loadLibrary, rulesToSessions } from "@/features/plan/generate";
import { ROUTINE_KEYS, ROUTINES, type RoutineKey } from "@/features/today/routines";
import { TrainingFlowClient } from "@/features/training/training-flow-client";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Routine" };

/** Routine ohne Wochenplan (noch kein Ziel) – gleicher Klick-Through wie ein Training. */
export default async function RoutinePage({ params }: PageProps<"/today/routine/[key]">) {
  const { key } = await params;
  if (!(ROUTINE_KEYS as readonly string[]).includes(key)) notFound();
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const supabase = await createClient();
  const routine = ROUTINES[key as RoutineKey];
  const [session] = rulesToSessions(
    [{ date: "", routine: routine.key, durationMin: routine.minutes, targetRpe: routine.rpe, lowerBody: false }],
    t,
    await loadLibrary(supabase),
  );
  const gymIds = session.exercises.map((e) => e.exerciseId).filter((x): x is string => Boolean(x));
  const none = "00000000-0000-0000-0000-000000000000";
  const [last, best, library] = await Promise.all([
    lastPerformances(supabase, user.id, gymIds, none, userToday(user.timezone)),
    bestE1rms(supabase, user.id, gymIds, none),
    listExercises(supabase),
  ]);

  return (
    <TrainingFlowClient
      title={session.title}
      durationMin={routine.minutes}
      exercises={session.exercises.map((e) => ({
        ...e,
        last: e.exerciseId ? (last[e.exerciseId]?.sets ?? null) : null,
        best: e.exerciseId ? (best[e.exerciseId] ?? null) : null,
      }))}
      finish={{ kind: "routine", key: routine.key }}
      library={library.map(({ id, name, muscleGroup, equipment }) => ({ id, name, muscleGroup, equipment }))}
      closeHref="/today"
    />
  );
}
