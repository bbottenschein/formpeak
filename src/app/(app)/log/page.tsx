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

function Check({ done }: { done: boolean }) {
  return done ? (
    <svg viewBox="0 0 20 20" className="size-5 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <span aria-hidden className="text-muted">→</span>
  );
}

/** + Erfassen – „Schnell eintragen“: große Kacheln, ein Tipp pro Eintrag. */
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

  const tile = "card flex min-h-20 items-center justify-between gap-2 text-left transition hover:border-muted/50";
  const tileTitle = "font-display text-lg font-semibold uppercase leading-tight tracking-wide";

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-4xl font-bold">{t("log.title")}</h1>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/checkin" className={`${tile} ${status.morning ? "opacity-60" : ""}`} aria-label={`${t("log.morning")}: ${status.morning ? t("log.done") : t("log.open")}`}>
          <span className="flex flex-col">
            <span className="eyebrow text-xs">{t("log.checkin")}</span>
            <span className={tileTitle}>{t("log.morningShort")}</span>
          </span>
          <Check done={status.morning} />
        </Link>
        <Link href="/checkin/evening" className={`${tile} ${status.evening ? "opacity-60" : ""}`} aria-label={`${t("log.evening")}: ${status.evening ? t("log.done") : t("log.open")}`}>
          <span className="flex flex-col">
            <span className="eyebrow text-xs">{t("log.checkin")}</span>
            <span className={tileTitle}>{t("log.eveningShort")}</span>
          </span>
          <Check done={status.evening} />
        </Link>
        <form action={startGymSession} className="contents">
          <button className={tile}>
            <span className={tileTitle}>{t("log.gymShort")}</span>
            <Check done={false} />
          </button>
        </form>
        <Link href={`/sessions/new?date=${today}`} className={tile}>
          <span className={tileTitle}>{t("log.planShort")}</span>
          <Check done={false} />
        </Link>
      </div>

      {openFeedback.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="eyebrow">{t("log.feedback")}</h2>
          {openFeedback.map((s) => (
            <QuickFeedback
              key={s.id}
              sessionId={s.id}
              title={s.title ?? t(`sessionTypes.${s.type}`)}
              meta={[formatLongDate(s.date), s.start_time?.slice(0, 5)].filter(Boolean).join(" · ")}
            />
          ))}
        </div>
      )}

      <BodyForm weight={body?.weight_kg == null ? null : Number(body.weight_kg)} waist={body?.waist_cm == null ? null : Number(body.waist_cm)} />
    </section>
  );
}
