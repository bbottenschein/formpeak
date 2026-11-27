import Link from "next/link";
import type { SessionRow } from "@/features/sessions/data";
import { Info } from "@/features/ui/info";
import type { Translate } from "@/lib/i18n/translate";
import { isBasisKey } from "./basis";
import { SessionChoices } from "./session-choices";
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

/** Wissenschaftliche Grundlage(n) einer Einheit – feste, geprüfte Texte (plan/basis.ts). */
export function BasisList({ basis, t }: { basis: string[]; t: Translate }) {
  const keys = basis.filter(isBasisKey);
  if (keys.length === 0) return null;
  return (
    <>
      <p className="eyebrow mt-2 text-xs">{t("basis.title")}</p>
      {keys.map((k) => (
        <p key={k}>{t(`basis.${k}`)}</p>
      ))}
    </>
  );
}

/** Hinweis „Heute angepasst“ mit Begründung hinter dem Info-Symbol. */
export function AdjustedBadge({ session, today, t }: { session: SessionRow; today: string; t: Translate }) {
  if (!session.adjustment || session.adjusted_on !== today) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs text-muted">
      {t("plan.adjust.badge")}
      <Info title={t("plan.adjust.badge")} className="-my-1 size-5">
        <p>{t(`plan.adjust.why.${session.adjustment}`)}</p>
      </Info>
    </span>
  );
}

/** Vorgeschlagene Einheit (Heute): Titel, Eckdaten, ein Knopf. Details hinter dem Info-Symbol. */
export function PlannedSessionCard({
  session,
  exercises,
  today,
  t,
}: {
  session: SessionRow;
  exercises: PlannedExercise[];
  today: string;
  t: Translate;
}) {
  const done = session.status === "done";
  const title = session.title ?? t(`sessionTypes.${session.type}`);
  const meta = [
    t("today2.minutes", { value: session.duration_min }),
    t(`sessionTypes.${session.type}`),
    exercises.length === 1
      ? t("plan.exerciseCountOne")
      : exercises.length > 1
        ? t("plan.exerciseCount", { count: exercises.length })
        : null,
  ].filter(Boolean);

  return (
    <div className={`card flex flex-col gap-3 ${done ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="font-display text-2xl font-semibold leading-tight">{title}</p>
          <p className="text-sm text-muted">{done ? t("sessionStatus.done") : meta.join(" · ")}</p>
        </div>
        {!done && session.rationale && (
          <Info title={title}>
            <p className="text-foreground">{session.rationale}</p>
            {session.target_rpe != null && <p>{t("plan.targetRpeInfo", { value: session.target_rpe })}</p>}
            <BasisList basis={session.basis} t={t} />
          </Info>
        )}
      </div>
      <AdjustedBadge session={session} today={today} t={t} />
      {!done && (
        <Link
          href={exercises.length > 0 ? `/sessions/${session.id}/train` : `/sessions/${session.id}`}
          className="btn-primary text-center"
        >
          {t("training.start")}
        </Link>
      )}
      {!done && <SessionChoices sessionId={session.id} />}
    </div>
  );
}
