import { diffDays } from "@/core/load";
import { Info } from "@/features/ui/info";
import type { Translate } from "@/lib/i18n/translate";
import type { ArchivedGoal } from "./lifecycle";
import { estimated1rmFrom5rm, progress, testSchedule, type TestEntry } from "./progress";
import type { GoalInput } from "./schema";
import { TestResultForm } from "./test-result-form";
import { lowerIsBetter, SELF_TESTS, type TestKey } from "./tests";

const date = (d: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const num = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

/** Zeitraum des Ziels oben: „27.11.2026 – 31.03.2027 · noch 18 Wochen“. */
export function GoalPeriod({ startsOn, targetDate, today, t }: { startsOn: string; targetDate: string | null; today: string; t: Translate }) {
  const weeks = targetDate ? Math.max(0, Math.ceil(diffDays(today, targetDate) / 7)) : null;
  return (
    <p className="eyebrow">
      {targetDate ? `${date(startsOn)} – ${date(targetDate)}` : t("goalView.since", { date: date(startsOn) })}
      {weeks != null && ` · ${t("goalView.weeksLeft", { weeks })}`}
    </p>
  );
}

/** Fortschritt eines Referenztests: nächster Termin, Ergebnis eintragen, Vorher-nachher, Zielwert. */
export function ProgressCard({
  testKey,
  goal,
  tests,
  today,
  t,
}: {
  testKey: TestKey;
  goal: GoalInput;
  tests: TestEntry[];
  today: string;
  t: Translate;
}) {
  const relevant = tests.filter((x) => x.testKey === testKey);
  const schedule = testSchedule(relevant, today);
  const unit = SELF_TESTS[testKey].unit;
  const target = goal.targets[testKey] ?? null;
  const values = schedule.done.map((d) => d.value!);
  const prog = progress(values, target, lowerIsBetter(testKey, goal.type));
  const reached = prog?.towardTargetPct === 100;
  const name = t(`goal.tests.${testKey}.name`);

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <p className="font-display text-xl font-semibold leading-tight">{name}</p>
          <p className="text-sm text-muted">
            {[
              schedule.daysUntil == null
                ? t("goalView.noTestPlanned")
                : schedule.daysUntil > 0
                  ? t("goalView.nextIn", { days: schedule.daysUntil })
                  : schedule.daysUntil === 0
                    ? t("goalView.nextToday")
                    : t("goalView.overdue", { days: -schedule.daysUntil }),
              target != null ? t("goalView.targetValue", { value: num(target), unit }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Info title={name}>
          <p className="text-foreground">{t(`goal.tests.${testKey}.how`)}</p>
          <p>{t(`goal.tests.${testKey}.why`)}</p>
          <p>{t("goalView.calendarHint")}</p>
        </Info>
      </div>

      {schedule.next && schedule.daysUntil != null && schedule.daysUntil <= 3 && <TestResultForm testId={schedule.next.id} unit={unit} />}

      {prog ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-3xl font-bold tabular-nums">
              {num(prog.first)} → {num(prog.latest)} <span className="text-base font-semibold text-muted">{unit}</span>
            </span>
            <span className="text-sm font-medium">
              {reached
                ? t("goalView.reached")
                : prog.improvement >= 0
                  ? t("goalView.betterShort", { pct: num(Math.abs(prog.improvementPct)) })
                  : t("goalView.worseShort", { pct: num(Math.abs(prog.improvementPct)) })}
            </span>
          </div>
          {prog.towardTargetPct != null && (
            <div className="h-1.5 w-full rounded-full bg-line" aria-label={t("goalView.toTarget", { value: prog.towardTargetPct })}>
              <div className="h-1.5 rounded-full bg-foreground/80" style={{ width: `${prog.towardTargetPct}%` }} />
            </div>
          )}
          {(testKey === "squat_5rm" || testKey === "bench_5rm") && (
            <span className="text-xs text-muted">{t("goalView.e1rm", { value: num(estimated1rmFrom5rm(prog.latest)) })}</span>
          )}
        </div>
      ) : (
        values.length === 1 && <p className="text-sm text-muted">{t("goalView.startValue", { value: num(values[0]), unit })}</p>
      )}
    </div>
  );
}

/** Archiv: alte Ziele zum Aufklappen, mit Ergebnis und Vorher-nachher. */
export function GoalArchive({ goals, t }: { goals: ArchivedGoal[]; t: Translate }) {
  if (goals.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="eyebrow">{t("goalView.archive")}</h2>
      <div className="card flex flex-col divide-y divide-line p-0">
        {goals.map((g) => (
          <details key={g.id} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{g.focuses.map((f) => t(`goal.types.${f}`)).join(" · ")}</span>
                <span className="text-xs text-muted">
                  {g.startsOn ? `${date(g.startsOn)} – ` : ""}
                  {date(g.endedOn)}
                </span>
              </span>
              <span className="shrink-0 text-sm">{t(`goalView.outcome.${g.outcome}`)}</span>
            </summary>
            <div className="mt-2 flex flex-col gap-1.5 text-sm">
              {g.description && <p className="text-muted">{g.description}</p>}
              {g.tests.map((x) => (
                <p key={x.key} className="flex justify-between gap-3">
                  <span>{t(`goal.tests.${x.key}.name`)}</span>
                  <span className="tabular-nums text-muted">
                    {x.first == null ? "–" : num(x.first)}
                    {x.last != null && ` → ${num(x.last)}`} {SELF_TESTS[x.key].unit}
                  </span>
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
