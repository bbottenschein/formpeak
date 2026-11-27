import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { completeRoutine, startGymRoutine } from "@/features/today/actions";
import { ROUTINE_KEYS, ROUTINES, type RoutineKey } from "@/features/today/routines";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";

export const metadata: Metadata = { title: "Routine" };

/** Routine mit Übungen; „Erledigt“ trägt sie als Einheit ein. */
export default async function RoutinePage({ params }: PageProps<"/today/routine/[key]">) {
  const { key } = await params;
  if (!(ROUTINE_KEYS as readonly string[]).includes(key)) notFound();
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const routine = ROUTINES[key as RoutineKey];

  const amount = (e: (typeof routine.exercises)[number]) =>
    e.reps
      ? t(`routines.reps.${e.reps}` as MessageKey)
      : e.seconds && e.seconds >= 120
        ? t("routines.minutes", { value: Math.round(e.seconds / 60) })
        : t("routines.seconds", { value: e.seconds ?? 0 });

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{t("today2.minutes", { value: routine.minutes })}</p>
        <h1 className="text-4xl font-bold">{t(`routines.titles.${routine.key}`)}</h1>
        <p className="mt-1 text-sm text-muted">{t(`today2.routineWhy.${routine.key}`)}</p>
      </div>

      <ol className="flex flex-col gap-2">
        {routine.exercises.map((e, i) => (
          <li key={`${e.key}-${i}`} className="card flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-3">
              <span className="font-display text-lg font-bold text-muted">{i + 1}</span>
              <span>{t(`routines.exercises.${e.key}` as MessageKey)}</span>
            </span>
            <span className="shrink-0 font-display font-semibold">{amount(e)}</span>
          </li>
        ))}
      </ol>

      {routine.sessionType === "gym" ? (
        <form action={startGymRoutine}>
          <button className="btn-primary w-full">{t("routines.planGym")}</button>
        </form>
      ) : (
        <form action={completeRoutine.bind(null, routine.key)}>
          <button className="btn-primary w-full">{t("routines.done")}</button>
        </form>
      )}
      <Link href="/today" className="text-center text-sm text-muted underline underline-offset-4">
        {t("routines.back")}
      </Link>
    </section>
  );
}
