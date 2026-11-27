import Link from "next/link";
import type { Translate } from "@/lib/i18n/translate";
import { estimated1rmFrom5rm, progress, testSchedule, type TestEntry } from "./progress";
import type { GoalInput } from "./schema";
import { TestResultForm } from "./test-result-form";
import { SELF_TESTS, lowerIsBetter } from "./tests";

const longDate = (d: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", year: "2-digit", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const num = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

/** Ziel-Bereich – „Komme ich voran?“: Ziel, Referenztest mit Termin, Vorher-nachher. */
export function GoalOverview({ goal, tests, today, t }: { goal: GoalInput; tests: TestEntry[]; today: string; t: Translate }) {
  const focus = t(`goal.goalFocus.${goal.type}`);
  const testKey = goal.testKey;
  const relevant = testKey ? tests.filter((x) => x.testKey === testKey) : [];
  const schedule = testSchedule(relevant, today);
  const unit = testKey ? SELF_TESTS[testKey].unit : "";
  const values = schedule.done.map((d) => d.value!);
  const prog = testKey ? progress(values, goal.targetValue, lowerIsBetter(testKey, goal.type)) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-2">
        <p className="text-xl font-medium leading-snug">
          {goal.targetDate
            ? t("goalView.sentence", { date: longDate(goal.targetDate), focus })
            : t("goalView.sentenceNoDate", { focus })}{" "}
          {goal.extraSessionsPerWeek > 0
            ? t("goalView.frame", { sessions: goal.extraSessionsPerWeek, minutes: goal.timeBudgetMin })
            : t("goalView.frameNone")}
        </p>
        <p className="text-sm text-muted">{goal.aiSummary || goal.description}</p>
        {goal.type === "weight_loss" && <p className="text-xs text-muted">{t("goal.weightLossNote")}</p>}
        <Link href="/goals/edit" className="self-start text-sm text-muted underline underline-offset-4">
          {t("goalView.edit")}
        </Link>
      </div>

      {testKey && (
        <div className="card flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="eyebrow">{t("goalView.test")}</h2>
            {schedule.daysUntil != null && (
              <span className={`font-display text-sm font-semibold ${schedule.daysUntil <= 0 ? "text-primary" : "text-muted"}`}>
                {schedule.daysUntil > 0
                  ? t("goalView.nextIn", { days: schedule.daysUntil })
                  : schedule.daysUntil === 0
                    ? t("goalView.nextToday")
                    : t("goalView.overdue", { days: -schedule.daysUntil })}
              </span>
            )}
          </div>
          <p className="font-display text-2xl font-semibold">{t(`goal.tests.${testKey}.name`)}</p>
          {schedule.done.length === 0 && <p className="text-sm">{t("goalView.firstTest")}</p>}
          {schedule.next && schedule.daysUntil != null && schedule.daysUntil <= 3 && (
            <TestResultForm testId={schedule.next.id} unit={unit} />
          )}
          {schedule.next && schedule.daysUntil != null && schedule.daysUntil > 3 && (
            <p className="text-xs text-muted">{t("goalView.calendarHint")}</p>
          )}
          {!schedule.next && <p className="text-sm text-muted">{t("goalView.noTestPlanned")}</p>}
          <details>
            <summary className="cursor-pointer text-sm underline underline-offset-4">{t("goalView.howTo")}</summary>
            <p className="mt-2 text-sm">{t(`goal.tests.${testKey}.how`)}</p>
            <p className="mt-2 text-sm text-muted">{t(`goal.tests.${testKey}.why`)}</p>
          </details>
        </div>
      )}

      {testKey && (
        <div className="card flex flex-col gap-3">
          <h2 className="eyebrow">{t("goalView.progress")}</h2>
          {prog ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted">{t("goalView.before")}</p>
                  <p className="font-display text-3xl font-bold tabular-nums">
                    {num(prog.first)} <span className="text-base font-semibold text-muted">{unit}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">{t("goalView.now")}</p>
                  <p className="font-display text-3xl font-bold tabular-nums">
                    {num(prog.latest)} <span className="text-base font-semibold text-muted">{unit}</span>
                  </p>
                </div>
              </div>
              <p className="font-medium">
                {prog.improvement >= 0
                  ? t("goalView.better", { value: num(Math.abs(prog.improvement)), unit, pct: num(Math.abs(prog.improvementPct)) })
                  : t("goalView.worse", { value: num(Math.abs(prog.improvement)), unit, pct: num(Math.abs(prog.improvementPct)) })}
              </p>
              {prog.towardTargetPct != null && (
                <div className="flex flex-col gap-1">
                  <div className="h-2 w-full rounded-full bg-line" aria-hidden>
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${prog.towardTargetPct}%` }} />
                  </div>
                  <p className="text-xs text-muted">{t("goalView.toTarget", { value: prog.towardTargetPct })}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">{t("goalView.onlyOne")}</p>
          )}
          {schedule.done.length > 0 && (
            <ul className="flex flex-col divide-y divide-line border-t border-line text-sm">
              {schedule.done.map((d) => (
                <li key={d.id} className="flex justify-between py-2">
                  <span className="text-muted">{shortDate(d.date!)}</span>
                  <span className="font-display font-semibold tabular-nums">
                    {num(d.value!)} {unit}
                    {(testKey === "squat_5rm" || testKey === "bench_5rm") && (
                      <span className="ml-2 font-normal text-muted">{t("goalView.e1rm", { value: num(estimated1rmFrom5rm(d.value!)) })}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
