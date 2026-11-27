import type { Metadata } from "next";
import { addDays, mondayOf } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { getReviewData, previousMonthStart, type ReviewKind } from "@/features/review/queries";
import { ReviewCard } from "@/features/review/review-card";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rückblick" };
// Der Text des Rückblicks entsteht beim ersten Öffnen (KI).
export const maxDuration = 120;

const num = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

/** Rückblick einer Woche oder eines Monats mit Bestwerten und Referenztests. */
export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const sp = await searchParams;
  const kind: ReviewKind = sp.kind === "month" ? "month" : "week";
  const valid = typeof sp.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.from);
  const from = valid ? (sp.from as string) : kind === "week" ? addDays(mondayOf(today), -7) : previousMonthStart(today);
  const supabase = await createClient();
  const [data, { data: cached }] = await Promise.all([
    getReviewData(supabase, user.id, kind, from, today),
    supabase.from("reviews").select("text").eq("user_id", user.id).eq("kind", kind).eq("period_start", from).maybeSingle(),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">{t("review.pageTitle")}</h1>
      <ReviewCard data={data} text={cached?.text ?? null} t={t} />
      <div className="flex flex-col gap-2">
        <h2 className="eyebrow">{t("review.bestsTitle")}</h2>
        {data.bests.length === 0 ? (
          <p className="text-sm text-muted">{t("review.noBests")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {data.bests.map((b) => (
              <li key={b.name} className="flex items-baseline justify-between gap-3 py-2.5">
                <span>{b.name}</span>
                <span className="text-sm tabular-nums text-muted">{t("review.e1rm", { value: num(b.e1rm) })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {data.tests.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="eyebrow">{t("review.testsTitle")}</h2>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {data.tests.map((x, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-2.5">
                <span>{t(`goal.tests.${x.key as "sprint10"}.name`)}</span>
                <span className="font-display font-semibold tabular-nums">{num(x.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-muted">
        {t("review.checkins")}: {data.stats.checkins}/{data.stats.days}
      </p>
    </section>
  );
}
