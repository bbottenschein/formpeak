import Link from "next/link";
import type { SessionRow } from "@/features/sessions/data";
import type { Translate } from "@/lib/i18n/translate";
import type { PlannedExercise } from "./types";

/** Übungsliste: Name und Vorgabe, darunter ein Satz zur Ausführung. */
export function ExerciseList({ exercises, t, label }: { exercises: PlannedExercise[]; t: Translate; label?: string }) {
  if (exercises.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="eyebrow">{label ?? t("plan.exercises")}</p>
      <ol className="flex flex-col divide-y divide-line border-y border-line">
        {exercises.map((e, i) => (
          <li key={i} className="flex flex-col gap-0.5 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{e.name}</span>
              {e.prescription && <span className="shrink-0 text-sm tabular-nums text-muted">{e.prescription}</span>}
            </div>
            {e.how && <p className="text-sm text-muted">{e.how}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Vorgeschlagene Einheit mit Begründung und erklärten Übungen (Heute). */
export function PlannedSessionCard({
  session,
  exercises,
  t,
}: {
  session: SessionRow;
  exercises: PlannedExercise[];
  t: Translate;
}) {
  const done = session.status === "done";
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-2xl font-semibold">{session.title ?? t(`sessionTypes.${session.type}`)}</p>
        <span className="shrink-0 text-sm text-muted">
          {done ? t("sessionStatus.done") : t("today2.minutes", { value: session.duration_min })}
        </span>
      </div>
      {!done && (
        <>
          <p className="text-sm text-muted">
            {[t(`sessionTypes.${session.type}`), session.target_rpe != null ? t("plan.targetRpe", { value: session.target_rpe }) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {session.rationale && <p className="text-sm">{session.rationale}</p>}
          <ExerciseList exercises={exercises} t={t} />
          <Link href={`/sessions/${session.id}`} className="btn-primary text-center">
            {t("plan.start")}
          </Link>
        </>
      )}
    </div>
  );
}
