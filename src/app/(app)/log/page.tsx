import type { Metadata } from "next";
import Link from "next/link";
import { mondayOf } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { getCheckinStatus } from "@/features/checkin/queries";
import { startGymSession } from "@/features/log/actions";
import { BodyForm } from "@/features/log/body-form";
import { QuickFeedback } from "@/features/overview/quick-feedback";
import { getWeek } from "@/features/week/queries";
import { formatLongDate, userToday, zonedParts } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Erfassen" };

/** + Erfassen – „Schnell eintragen“. */
export default async function LogPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const supabase = await createClient();
  const [status, week, { data: body }] = await Promise.all([
    getCheckinStatus(user.id, today),
    getWeek(user.id, mondayOf(today), today, null),
    supabase.from("body_measurements").select("weight_kg, waist_cm").eq("user_id", user.id).eq("date", today).maybeSingle(),
  ]);
  const nowTime = zonedParts(new Date(), user.timezone).time;
  const openFeedback = week.days
    .flatMap((d) => d.sessions)
    .filter((s) => s.feedbackDue && (s.date < today || !s.start_time || s.start_time.slice(0, 5) <= nowTime));

  const tile = (href: string, title: string, sub: string, done = false) => (
    <Link href={href} className="card flex items-center justify-between gap-3 transition hover:border-muted/50">
      <span>
        <span className="block font-display text-lg font-semibold uppercase tracking-wide">{title}</span>
        <span className={`text-sm ${done ? "text-muted" : ""}`}>{sub}</span>
      </span>
      <span aria-hidden className="text-muted">→</span>
    </Link>
  );

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-4xl font-bold">{t("log.title")}</h1>
      <div className="grid gap-2">
        {tile("/checkin", t("log.morning"), status.morning ? t("log.done") : t("log.open"), status.morning)}
        {tile("/checkin/evening", t("log.evening"), status.evening ? t("log.done") : t("log.open"), status.evening)}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="eyebrow">{t("log.feedback")}</h2>
        {openFeedback.length === 0 && <p className="text-sm text-muted">{t("log.noFeedback")}</p>}
        {openFeedback.map((s) => (
          <QuickFeedback
            key={s.id}
            sessionId={s.id}
            title={t(`sessionTypes.${s.type}`)}
            meta={[formatLongDate(s.date), s.start_time?.slice(0, 5)].filter(Boolean).join(" · ")}
          />
        ))}
      </div>

      <form action={startGymSession}>
        <button className="card flex w-full items-center justify-between gap-3 text-left transition hover:border-muted/50">
          <span>
            <span className="block font-display text-lg font-semibold uppercase tracking-wide">{t("log.gym")}</span>
            <span className="text-sm text-muted">{t("log.gymHint")}</span>
          </span>
          <span aria-hidden className="text-muted">→</span>
        </button>
      </form>
      {tile(`/sessions/new?date=${today}`, t("log.plan"), t("log.planHint"))}

      <BodyForm weight={body?.weight_kg == null ? null : Number(body.weight_kg)} waist={body?.waist_cm == null ? null : Number(body.waist_cm)} />
    </section>
  );
}
