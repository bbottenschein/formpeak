import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { bestE1rms, lastPerformances, listExercises } from "@/features/gym/queries";
import { getPlannedExercises } from "@/features/plan/queries";
import { SESSION_COLUMNS, type SessionRow } from "@/features/sessions/data";
import { TrainingFlowClient } from "@/features/training/training-flow-client";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Training" };

/** Training als Klick-Through: Übung für Übung, am Ende Feedback. */
export default async function TrainPage({ params }: PageProps<"/sessions/[id]/train">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const supabase = await createClient();
  const { data } = await supabase.from("sessions").select(SESSION_COLUMNS).eq("id", id).eq("user_id", user.id).maybeSingle();
  const session = data as SessionRow | null;
  const exercises = (await getPlannedExercises([id]))[id] ?? [];
  if (!session || session.status !== "planned" || exercises.length === 0) redirect(`/sessions/${id}`);

  const gymIds = exercises.map((e) => e.exerciseId).filter((x): x is string => Boolean(x));
  const [last, best, library] = await Promise.all([
    lastPerformances(supabase, user.id, gymIds, id, userToday(user.timezone)),
    bestE1rms(supabase, user.id, gymIds, id),
    listExercises(supabase),
  ]);

  return (
    <TrainingFlowClient
      title={session.title ?? t(`sessionTypes.${session.type}`)}
      durationMin={session.duration_min}
      exercises={exercises.map((e) => ({
        ...e,
        last: e.exerciseId ? (last[e.exerciseId]?.sets ?? null) : null,
        best: e.exerciseId ? (best[e.exerciseId] ?? null) : null,
      }))}
      finish={{ kind: "session", id }}
      library={library.map(({ id, name, muscleGroup, equipment }) => ({ id, name, muscleGroup, equipment }))}
      closeHref="/today"
    />
  );
}
