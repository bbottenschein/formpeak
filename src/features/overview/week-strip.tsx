import Link from "next/link";
import { weekdayOf } from "@/core/load";
import type { Translate } from "@/lib/i18n/translate";
import type { WeekData } from "@/features/week/queries";

/**
 * Woche auf einen Blick: sieben Spalten mit MD-Label und den festen Terminen
 * (TR = Training, SP = Spiel). Zusatzeinheiten erscheinen als Zähler.
 */
export function WeekStrip({ week, today, t }: { week: WeekData; today: string; t: Translate }) {
  return (
    <ol className="grid grid-cols-7 gap-1">
      {week.days.map((day) => {
        const isToday = day.date === today;
        const active = day.sessions.filter((s) => s.status !== "cancelled");
        const fixtures = active.filter((s) => s.is_fixture);
        const extras = active.length - fixtures.length;
        const wd = weekdayOf(day.date) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
        return (
          <li key={day.date}>
            <Link
              href={`/week?start=${day.date}#${day.date}`}
              aria-current={isToday ? "date" : undefined}
              className={`flex h-full min-h-28 flex-col items-center gap-1 rounded-lg border px-0.5 py-2 text-center ${
                isToday ? "border-primary" : "border-line bg-surface"
              }`}
            >
              <span className={`font-display text-sm font-semibold uppercase ${isToday ? "text-primary" : "text-muted"}`}>
                {t(`weekdays.short.${wd}`)}
              </span>
              <span className="font-display text-xl font-bold leading-none tabular-nums">{Number(day.date.slice(8))}</span>
              <span className="h-4 font-display text-[0.7rem] font-semibold tabular-nums text-muted">{day.mdLabel ?? ""}</span>
              <span className="mt-auto flex flex-col items-center gap-0.5">
                {fixtures.map((s) => (
                  <span
                    key={s.id}
                    className={`rounded px-1 font-display text-[0.7rem] font-bold ${
                      s.type === "match" ? "bg-foreground text-background" : "border border-foreground/60"
                    } ${s.status === "done" ? "opacity-60" : ""}`}
                  >
                    {t(`overview.fixtures.${s.type as "training" | "match"}`)}
                  </span>
                ))}
                {extras > 0 && <span className="text-[0.7rem] text-muted">{t("overview.extra", { count: extras })}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
