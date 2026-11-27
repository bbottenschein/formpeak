import Link from "next/link";
import { addDays, weekdayOf, type WeekHint } from "@/core/load";
import { SessionCard } from "@/features/sessions/session-card";
import { Info } from "@/features/ui/info";
import type { Translate } from "@/lib/i18n/translate";
import type { WeekData } from "./queries";
import { WeekBoard, type BoardDay } from "./week-board";

const shortDate = (date: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

function weekHintText(h: WeekHint, t: Translate) {
  return h.code === "weekly_load_increase" ? t("week.hints.weekly_load_increase", { percent: h.percent }) : t(`week.hints.${h.code}`);
}

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Kalender – „Wann ist was?“: Wochenleiste mit Balken, darunter der gewählte Tag, unten die Wochenlast. */
export function WeekView({ week, today, t }: { week: WeekData; today: string; t: Translate }) {
  const sunday = addDays(week.monday, 6);
  const isGoalTest = (r: { rationale: string | null }) => Boolean(r.rationale?.startsWith("goal_test:"));

  const board: BoardDay[] = week.days.map((day) => ({
    date: day.date,
    weekday: t(`weekdays.short.${weekdayOf(day.date) as Weekday}`),
    dayNum: String(Number(day.date.slice(8, 10))),
    md: day.mdLabel,
    isToday: day.date === today,
    bars: [
      ...day.sessions
        .filter((s) => s.status !== "cancelled")
        .map((s) => ({
          kind: s.is_fixture ? ("fixture" as const) : isGoalTest(s) ? ("test" as const) : ("plan" as const),
          minutes: s.duration_min,
          done: s.status === "done",
        })),
      ...(day.goalTests.length && !day.sessions.some(isGoalTest) ? [{ kind: "test" as const, minutes: 30, done: false }] : []),
    ],
  }));

  const details = week.days.map((day) => {
    const active = day.sessions.filter((s) => s.status !== "cancelled");
    return (
      <div key={day.date} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className={`font-display text-lg font-semibold uppercase tracking-wide ${day.date === today ? "text-primary" : ""}`}>
            {t(`weekdays.long.${weekdayOf(day.date) as Weekday}`)} <span className="text-muted">{shortDate(day.date)}</span>
          </h2>
          {day.mdLabel && <span className="rounded-md border border-line px-2 py-0.5 font-display text-sm font-semibold tabular-nums">{day.mdLabel}</span>}
        </div>
        {(day.sessions.some(isGoalTest) ? [] : day.goalTests).map((key) => (
          <Link key={key} href="/goals" className="card flex items-center justify-between gap-2 border-dashed py-3">
            <span className="font-display text-lg font-semibold uppercase tracking-wide">
              {t("week.goalTest", { name: t(`goal.tests.${key as "sprint10"}.name`) })}
            </span>
            <span aria-hidden className="text-muted">→</span>
          </Link>
        ))}
        {day.sessions.map((s) => (
          <SessionCard key={s.id} session={s} hints={s.hints} feedbackDue={s.feedbackDue} t={t} />
        ))}
        {active.length === 0 && day.goalTests.length === 0 && <p className="text-sm text-muted">{t("week.restDay")}</p>}
        <Link href={`/sessions/new?date=${day.date}`} className="self-start text-sm text-muted underline underline-offset-4">
          + {t("week.addSession")}
        </Link>
      </div>
    );
  });

  const todayIndex = week.days.findIndex((d) => d.date === today);
  const delta = week.load.reference > 0 ? Math.round((week.load.planned / week.load.reference - 1) * 100) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/week?start=${addDays(week.monday, -7)}`} className="btn-secondary px-3 py-2" aria-label={t("week.prev")}>
          ←
        </Link>
        <div className="text-center">
          <p className="font-display text-xl font-semibold">{t("week.rangeLabel", { from: shortDate(week.monday), to: shortDate(sunday) })}</p>
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
        <Link href="/calendar" className="card flex items-center justify-between gap-3 text-sm">
          <span>{t("week.noCalendarShort")}</span>
          <span aria-hidden className="text-muted">→</span>
        </Link>
      )}

      <WeekBoard days={board} details={details} initial={todayIndex >= 0 ? todayIndex : 0} />

      {week.hints.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl border border-light-yellow/45 bg-light-yellow/10 p-3 text-sm text-light-yellow">
          {week.hints.map((h) => (
            <li key={h.code}>{weekHintText(h, t)}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span>
            {t("week.weekLoad", { value: Math.round(week.load.planned).toLocaleString("de-DE") })}
            {delta != null && <span className="text-muted"> ({delta > 0 ? "+" : delta < 0 ? "−" : "±"}{Math.abs(delta)} %)</span>}
          </span>
          <Info title={t("week.loadInfoTitle")}>
            <p>{t("week.loadInfo")}</p>
            <p>{t("week.legend")}</p>
          </Info>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href={`/sessions/new?date=${week.monday < today && today <= sunday ? today : week.monday}&fixture=1`} className="text-muted underline underline-offset-4">
            + {t("week.addFixtureShort")}
          </Link>
          <Link href="/calendar" className="text-muted underline underline-offset-4">
            {t("week.manageCalendar")}
          </Link>
        </div>
      </div>
    </div>
  );
}
