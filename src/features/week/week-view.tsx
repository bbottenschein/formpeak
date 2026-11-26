import Link from "next/link";
import { addDays, weekdayOf, type WeekHint } from "@/core/load";
import { SessionCard } from "@/features/sessions/session-card";
import type { Translate } from "@/lib/i18n/translate";
import type { WeekData } from "./queries";

const shortDate = (date: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );

function weekHintText(h: WeekHint, t: Translate) {
  return h.code === "weekly_load_increase"
    ? t("week.hints.weekly_load_increase", { percent: h.percent })
    : t(`week.hints.${h.code}`);
}

export function WeekView({ week, today, t }: { week: WeekData; today: string; t: Translate }) {
  const sunday = addDays(week.monday, 6);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/week?start=${addDays(week.monday, -7)}`} className="btn-secondary px-3 py-2" aria-label={t("week.prev")}>
          ←
        </Link>
        <div className="text-center">
          <p className="font-display text-xl font-semibold">
            {t("week.rangeLabel", { from: shortDate(week.monday), to: shortDate(sunday) })}
          </p>
          {(today < week.monday || today > sunday) && (
            <Link href="/week" className="text-xs text-muted underline underline-offset-4">
              {t("week.thisWeek")}
            </Link>
          )}
        </div>
        <Link href={`/week?start=${addDays(week.monday, 7)}`} className="btn-secondary px-3 py-2" aria-label={t("week.next")}>
          →
        </Link>
      </div>

      {!week.hasSeries && (
        <div className="card flex flex-col gap-3">
          <p className="text-sm text-muted">{t("week.noCalendar")}</p>
          <Link href="/calendar" className="btn-primary text-center">
            {t("week.manageCalendar")}
          </Link>
        </div>
      )}

      {week.hints.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl border border-light-yellow/45 bg-light-yellow/10 p-3 text-sm text-light-yellow">
          {week.hints.map((h) => (
            <li key={h.code}>{weekHintText(h, t)}</li>
          ))}
        </ul>
      )}

      <ol className="flex flex-col gap-4">
        {week.days.map((day) => {
          const isToday = day.date === today;
          const active = day.sessions.filter((s) => s.status !== "cancelled");
          return (
            <li key={day.date} id={day.date} className="flex scroll-mt-4 flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className={`font-display text-lg font-semibold uppercase tracking-wide ${isToday ? "text-primary" : ""}`}>
                  {t(`weekdays.long.${weekdayOf(day.date) as 0 | 1 | 2 | 3 | 4 | 5 | 6}`)}{" "}
                  <span className="text-muted">{shortDate(day.date)}</span>
                  {isToday && <span className="ml-2 text-xs">· {t("week.today")}</span>}
                </h2>
                {day.mdLabel && (
                  <span className="rounded-md border border-line px-2 py-0.5 font-display text-sm font-semibold tabular-nums">
                    {day.mdLabel}
                  </span>
                )}
              </div>
              {day.sessions.map((s) => (
                <SessionCard key={s.id} session={s} hints={s.hints} feedbackDue={s.feedbackDue} t={t} />
              ))}
              {active.length === 0 && <p className="text-sm text-muted">{t("week.restDay")}</p>}
              <Link href={`/sessions/new?date=${day.date}`} className="self-start text-sm text-muted underline underline-offset-4">
                + {t("week.addSession")}
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
        <p className="text-muted">{t("week.plannedLoad", { value: Math.round(week.plannedLoad) })}</p>
        <Link href={`/sessions/new?date=${week.monday < today && today <= sunday ? today : week.monday}&fixture=1`} className="text-muted underline underline-offset-4">
          + {t("week.addFixture")}
        </Link>
        <Link href="/calendar" className="text-muted underline underline-offset-4">
          {t("week.manageCalendar")}
        </Link>
      </div>
    </div>
  );
}
