"use client";

import { useState, useTransition } from "react";
import { addDays, offseasonWeek, returnWeeks } from "@/core/load";
import { EQUIPMENT_OPTIONS, TIME_BUDGETS } from "@/features/goals/schema";
import { Wizard, WizardQuestion } from "@/features/shell/wizard";
import { Info } from "@/features/ui/info";
import { useT } from "@/lib/i18n/client";
import { saveOffseason } from "./actions";
import type { OffseasonInput } from "./schema";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
type StepKey = "end" | "recovery" | "frequency" | "days" | "duration" | "equipment" | "summary";
const STEPS: StepKey[] = ["end", "recovery", "frequency", "days", "duration", "equipment", "summary"];

const chip = (active: boolean) =>
  `rounded-lg border px-3 py-3 text-base font-medium transition ${
    active ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface hover:border-muted/50"
  }`;
const formatDate = (d: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** Off-Season-Assistent: Vorbereitung → Erholung → Häufigkeit → Tage → Dauer → Mittel → Zusammenfassung. */
export function OffseasonForm({ initial, today, editing }: { initial: OffseasonInput; today: string; editing: boolean }) {
  const t = useT();
  const [o, setO] = useState<OffseasonInput>(initial);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const step = STEPS[index];
  const next = () => setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const pick = (patch: Partial<OffseasonInput>) => {
    setO({ ...o, ...patch });
    next();
  };

  // Abschnitte für die Zusammenfassung (gleiche Logik wie die Planung).
  const endsOn = o.preseasonStart ? addDays(o.preseasonStart, -1) : null;
  const phase = { startsOn: today, endsOn, recoveryWeeks: o.recoveryWeeks };
  const total = offseasonWeek(phase, today).totalWeeks;
  const ret = returnWeeks(total, o.recoveryWeeks);
  const blocks = [
    { key: "recover" as const, weeks: o.recoveryWeeks },
    { key: "build" as const, weeks: total == null ? null : Math.max(0, total - o.recoveryWeeks - ret) },
    { key: "return" as const, weeks: ret },
  ].filter((b) => b.weeks == null || b.weeks > 0);

  return (
    <Wizard
      step={index}
      total={STEPS.length}
      onBack={index > 0 ? () => setIndex((i) => i - 1) : undefined}
      onNext={next}
      nextDisabled={(step === "days" && o.availableWeekdays.length !== o.extraSessionsPerWeek) || (step === "equipment" && o.equipment.length === 0)}
      hideNext={step === "recovery" || step === "frequency" || step === "duration" || step === "summary" || (step === "end" && !o.preseasonStart)}
    >
      {step === "end" && (
        <>
          <WizardQuestion title={t("offseason.wizard.endTitle")} hint={t("offseason.wizard.endHint")} />
          <input
            type="date"
            min={addDays(today, 1)}
            value={o.preseasonStart ?? ""}
            onChange={(e) => setO({ ...o, preseasonStart: e.target.value || null })}
            className="input text-lg"
          />
          <button type="button" onClick={() => pick({ preseasonStart: null })} className="self-start text-sm text-muted underline underline-offset-4">
            {t("offseason.wizard.endOpen")}
          </button>
        </>
      )}

      {step === "recovery" && (
        <>
          <WizardQuestion title={t("offseason.wizard.recoveryTitle")} hint={t("offseason.wizard.recoveryHint")} />
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((n) => (
              <button key={n} type="button" onClick={() => pick({ recoveryWeeks: n })} className={`${chip(o.recoveryWeeks === n)} text-left`}>
                {t(`offseason.wizard.recovery${n as 0 | 1 | 2}`)}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "frequency" && (
        <>
          <WizardQuestion title={t("offseason.wizard.frequencyTitle")} hint={t("offseason.wizard.frequencyHint")} />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => pick({ extraSessionsPerWeek: n, availableWeekdays: o.availableWeekdays.slice(0, n) })}
                className={`${chip(o.extraSessionsPerWeek === n)} py-5 font-display text-3xl font-bold`}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "days" && (
        <>
          <WizardQuestion
            title={
              o.extraSessionsPerWeek === 1
                ? t("offseason.wizard.daysTitleOne")
                : t("offseason.wizard.daysTitleCount", { count: o.extraSessionsPerWeek })
            }
          />
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_ORDER.map((d) => {
              const active = o.availableWeekdays.includes(d);
              const full = !active && o.availableWeekdays.length >= o.extraSessionsPerWeek;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  disabled={full}
                  onClick={() =>
                    setO({
                      ...o,
                      availableWeekdays: active ? o.availableWeekdays.filter((x) => x !== d) : [...o.availableWeekdays, d],
                    })
                  }
                  className={`${chip(active)} px-1 ${full ? "opacity-40" : ""}`}
                >
                  {t(`weekdays.short.${d}`)}
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === "duration" && (
        <>
          <WizardQuestion title={t("offseason.wizard.durationTitle")} />
          <div className="grid grid-cols-2 gap-2">
            {TIME_BUDGETS.map((m) => (
              <button key={m} type="button" onClick={() => pick({ timeBudgetMin: m })} className={`${chip(o.timeBudgetMin === m)} py-5 font-display text-2xl font-bold`}>
                {t("goal.minutes", { value: m })}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "equipment" && (
        <>
          <WizardQuestion title={t("offseason.wizard.equipmentTitle")} note={t("goal.step5Hint")} />
          <div className="flex flex-col gap-2">
            {EQUIPMENT_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={o.equipment.includes(e)}
                onClick={() => setO({ ...o, equipment: o.equipment.includes(e) ? o.equipment.filter((x) => x !== e) : [...o.equipment, e] })}
                className={`${chip(o.equipment.includes(e))} text-left`}
              >
                {t(`goal.equipmentTypes.${e}`)}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "summary" && (
        <div className="flex flex-col gap-5">
          <WizardQuestion title={t("offseason.wizard.summaryTitle")} />
          <div className="card flex flex-col gap-1">
            <p className="font-display text-2xl font-semibold">
              {o.preseasonStart ? t("offseason.wizard.untilDate", { date: formatDate(o.preseasonStart) }) : t("offseason.openEnd")}
            </p>
            <p className="text-sm text-muted">
              {t("offseason.wizard.summaryFrame", { count: o.extraSessionsPerWeek, minutes: o.timeBudgetMin })} ·{" "}
              {o.availableWeekdays
                .slice()
                .sort((a, b) => WEEKDAY_ORDER.indexOf(a as 0) - WEEKDAY_ORDER.indexOf(b as 0))
                .map((d) => t(`weekdays.short.${d as 0}`))
                .join(", ")}
            </p>
          </div>
          <ol className="flex flex-col divide-y divide-line border-y border-line">
            {blocks.map((b) => (
              <li key={b.key} className="flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-1.5">
                  <span className="font-display text-lg font-semibold uppercase tracking-wide">{t(`offseason.blocks.${b.key}`)}</span>
                  <Info title={t(`offseason.blocks.${b.key}`)} className="-my-1">
                    <p>{t(`offseason.blockInfo.${b.key}`)}</p>
                  </Info>
                </span>
                <span className="text-sm tabular-nums text-muted">{b.weeks == null ? "…" : t("offseason.wizard.weeks", { count: b.weeks })}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">{t("offseason.wizard.pauseNote")}</p>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {t("offseason.wizard.error")}
            </p>
          )}
          <button
            type="button"
            disabled={pending}
            className="btn-primary"
            onClick={() =>
              startTransition(async () => {
                setError(false);
                const res = await saveOffseason(o);
                if (res?.error) setError(true);
              })
            }
          >
            {pending ? t("offseason.wizard.saving") : editing ? t("offseason.wizard.save") : t("offseason.wizard.start")}
          </button>
        </div>
      )}
    </Wizard>
  );
}
