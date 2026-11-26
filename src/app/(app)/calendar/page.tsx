import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { endSeries } from "@/features/calendar/actions";
import { SeriesForm } from "@/features/calendar/series-form";
import { SERIES_COLUMNS, type SeriesRow } from "@/features/sessions/data";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kalender" };

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const formatDate = (d: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );

export default async function CalendarPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("fixture_series")
    .select(SERIES_COLUMNS)
    .eq("user_id", user.id)
    .order("kind", { ascending: false })
    .order("created_at");
  const series = (data ?? []) as SeriesRow[];

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold">{t("calendar.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("calendar.intro")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="eyebrow">{t("calendar.series")}</h2>
        {series.length === 0 && <p className="text-sm text-muted">{t("calendar.noSeries")}</p>}
        {series.map((s) => (
          <div key={s.id} className="card flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-lg font-semibold uppercase tracking-wide">
                {t(`sessionTypes.${s.kind}`)}
              </span>
              <form action={endSeries.bind(null, s.id)}>
                <button className="text-sm text-muted underline underline-offset-4">{t("calendar.deleteSeries")}</button>
              </form>
            </div>
            <span className="text-sm text-muted">
              {t("calendar.seriesLine", {
                days: WEEKDAY_ORDER.filter((d) => s.weekdays.includes(d))
                  .map((d) => t(`weekdays.short.${d as 0 | 1 | 2 | 3 | 4 | 5 | 6}`))
                  .join(" + "),
                time: s.start_time?.slice(0, 5) ?? "–",
                duration: s.duration_min,
                intensity: t(`intensity.${s.expected_intensity}`),
              })}
            </span>
            <span className="text-xs text-muted">
              {t("calendar.since", { date: formatDate(s.valid_from) })}
              {s.valid_until && ` · ${t("calendar.until", { date: formatDate(s.valid_until) })}`} · RPE {s.default_rpe}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="eyebrow">{t("calendar.addSeries")}</h2>
        <SeriesForm key={series.length} today={userToday(user.timezone)} />
      </div>
    </section>
  );
}
