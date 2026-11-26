import type { Metadata } from "next";
import Link from "next/link";
import { sessionLoad } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { cancelSession, deleteSession, moveSession, restoreSession } from "@/features/sessions/actions";
import { SESSION_COLUMNS, toCoreSession, type SessionRow } from "@/features/sessions/data";
import { FeedbackForm } from "@/features/sessions/feedback-form";
import { GymLog } from "@/features/gym/gym-log";
import { lastPerformances, listExercises, loadGymLog } from "@/features/gym/queries";
import { computeMetricsFor } from "@/features/today/metrics";
import type { FeedbackInput } from "@/features/sessions/schema";
import { formatLongDate, userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Einheit" };

export default async function SessionPage({ params }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const supabase = await createClient();
  const { data } = await supabase.from("sessions").select(SESSION_COLUMNS).eq("id", id).eq("user_id", user.id).maybeSingle();
  const session = data as SessionRow | null;

  if (!session) {
    return (
      <section className="flex flex-col gap-4">
        <p className="card text-sm">{t("session.notFound")}</p>
        <Link href="/week" className="btn-secondary text-center">
          {t("common.back")}
        </Link>
      </section>
    );
  }

  const { data: pains } = await supabase
    .from("pain_entries")
    .select("region, side, intensity, kind, swollen")
    .eq("session_id", id);

  const load = sessionLoad(toCoreSession(session), today);

  let gym: React.ReactNode = null;
  if (session.type === "gym" && session.status !== "cancelled") {
    const [library, log] = await Promise.all([listExercises(supabase), loadGymLog(supabase, session.id)]);
    const last = await lastPerformances(
      supabase,
      user.id,
      log.map((e) => e.exerciseId),
      session.id,
      session.date,
    );
    const light = session.date === today ? (await computeMetricsFor(user.id, today, today)).light : undefined;
    gym = <GymLog sessionId={session.id} library={library} initial={log} last={last} light={light} />;
  }
  const canGiveFeedback = session.status !== "cancelled" && session.date <= today;
  const initial: FeedbackInput = {
    durationMin: session.duration_min,
    rpe: session.rpe ?? session.target_rpe ?? session.default_rpe,
    fatigue: session.fatigue ?? 3,
    matchMinutes: session.match_minutes ?? (session.type === "match" ? 90 : null),
    pains: (pains ?? []) as FeedbackInput["pains"],
  };

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">
          {formatLongDate(session.date)}
          {session.start_time && ` · ${session.start_time.slice(0, 5)}`}
        </p>
        <h1 className="text-4xl font-bold">{t(`sessionTypes.${session.type}`)}</h1>
        <p className="mt-1 text-sm text-muted">
          {[
            session.series_id ? t("session.fromSeries") : null,
            t(`sessionStatus.${session.status}`),
            load.counts ? `${t("session.load", { value: load.load })}${load.estimated ? ` (${t("week.estimated")})` : ""}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {session.notes && <p className="mt-2 text-sm">{session.notes}</p>}
        {session.against_recommendation && <p className="mt-2 text-sm text-light-yellow">{t("session.againstRecommendation")}</p>}
      </div>

      {gym}

      {canGiveFeedback ? (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-2xl font-bold">{t("session.feedbackTitle")}</h2>
            <p className="text-sm text-muted">{t("session.feedbackIntro")}</p>
          </div>
          <FeedbackForm sessionId={session.id} isMatch={session.type === "match"} initial={initial} />
        </div>
      ) : (
        session.status !== "cancelled" && <p className="text-sm text-muted">{t("session.futureFeedback")}</p>
      )}

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        {session.status === "cancelled" ? (
          <form action={restoreSession.bind(null, session.id)}>
            <button className="btn-secondary w-full">{t("session.restore")}</button>
          </form>
        ) : (
          <form action={cancelSession.bind(null, session.id)}>
            <button className="btn-secondary w-full">{t("session.markCancelled")}</button>
          </form>
        )}

        {session.status !== "done" && (
          <form action={moveSession.bind(null, session.id)} className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="label">{t("session.move")}</span>
              <input name="date" type="date" defaultValue={session.date} required className="input" />
            </label>
            <button className="btn-secondary">{t("session.moveSubmit")}</button>
          </form>
        )}

        {!session.series_id && (
          <form action={deleteSession.bind(null, session.id)}>
            <button className="w-full py-2 text-sm text-danger underline underline-offset-4">{t("session.delete")}</button>
          </form>
        )}
      </div>
    </section>
  );
}
