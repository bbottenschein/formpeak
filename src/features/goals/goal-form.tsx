"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Wizard, WizardQuestion } from "@/features/shell/wizard";
import { Info } from "@/features/ui/info";
import { useT } from "@/lib/i18n/client";
import { previewGoal, saveGoal, type GoalState } from "./actions";
import type { GoalSummaryResult } from "./ai";
import { EQUIPMENT_OPTIONS, GOAL_TYPES, TIME_BUDGETS, type GoalInput } from "./schema";
import { SELF_TESTS, suggestTests, type TestKey } from "./tests";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
type StepKey = "goal" | "date" | "frequency" | "days" | "duration" | "equipment" | "summary";

/** Welche Teile der Assistent abfragt: alles (Onboarding), nur das Ziel oder nur den Saison-Rahmen. */
export type GoalFormPart = "all" | "goal" | "frame";

function stepsFor(g: GoalInput, part: GoalFormPart): StepKey[] {
  const goal: StepKey[] = ["goal", "date"];
  const frame: StepKey[] = g.extraSessionsPerWeek === 0 ? ["frequency"] : ["frequency", "days", "duration", "equipment"];
  if (part === "goal") return [...goal, "summary"];
  if (part === "frame") return [...frame, "summary"];
  return [...goal, ...frame, "summary"];
}

const chip = (active: boolean) =>
  `rounded-lg border px-3 py-3 text-base font-medium transition ${
    active ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface hover:border-muted/50"
  }`;

const toNumber = (raw: string) => {
  const n = Number(raw.replace(",", "."));
  return raw.trim() === "" || !Number.isFinite(n) ? null : n;
};
const formatDate = (d: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );

/** Ziel-Assistent: eine Frage pro Schritt, am Ende Zusammenfassung mit KI-Text, Target und Testvorschlag. */
export function GoalForm({ initial, part = "all" }: { initial: GoalInput; part?: GoalFormPart }) {
  const t = useT();
  const [g, setG] = useState<GoalInput>(initial);
  const [stepIndex, setStepIndex] = useState(0);
  const [state, action, pending] = useActionState<GoalState, FormData>(saveGoal, {});
  const [preview, setPreview] = useState<GoalSummaryResult | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const steps = stepsFor(g, part);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const go = (key: StepKey) => goToIndex(steps.indexOf(key));
  const next = (snapshot: GoalInput = g) => goToIndex(Math.min(stepIndex + 1, steps.length - 1), snapshot);
  const back = stepIndex > 0 ? () => setStepIndex((i) => i - 1) : undefined;

  // KI-Zusammenfassung holen, sobald die Zusammenfassung erreicht wird und sich die Eingaben geändert haben.
  function loadPreview(snapshot: GoalInput) {
    const key = JSON.stringify([
      snapshot.type,
      snapshot.description,
      snapshot.extraSessionsPerWeek,
      snapshot.timeBudgetMin,
      snapshot.availableWeekdays,
      snapshot.equipment,
      snapshot.targetDate,
    ]);
    if (previewKey === key) return;
    setPreviewKey(key);
    startLoading(async () => {
      const result = await previewGoal({
        type: snapshot.type,
        description: snapshot.description,
        extraSessionsPerWeek: snapshot.extraSessionsPerWeek,
        timeBudgetMin: snapshot.timeBudgetMin,
        availableWeekdays: snapshot.availableWeekdays,
        equipment: snapshot.equipment,
        targetDate: snapshot.targetDate,
      });
      setPreview(result);
      setG((prev) => {
        // Eigene Testwahl behalten, solange sie zum Ziel passt; sonst den Vorschlag nehmen.
        const fits = suggestTests(prev.type, prev.equipment).some((x) => x.key === prev.testKey);
        const testKey = fits && prev.testKey ? prev.testKey : result.testKey;
        return { ...prev, aiSummary: result.source === "ai" ? result.summary : null, testKey, unit: SELF_TESTS[testKey].unit };
      });
    });
  }

  /** Zu einem Schritt wechseln; beim Erreichen der Zusammenfassung die KI fragen. */
  function goToIndex(index: number, snapshot: GoalInput = g) {
    const list = stepsFor(snapshot, part);
    setStepIndex(index);
    if (list[index] === "summary") loadPreview(snapshot);
  }

  const tests = useMemo(() => suggestTests(g.type, g.equipment), [g.type, g.equipment]);
  const toggleDay = (d: number) => {
    const has = g.availableWeekdays.includes(d);
    if (has) setG({ ...g, availableWeekdays: g.availableWeekdays.filter((x) => x !== d) });
    else if (g.availableWeekdays.length < g.extraSessionsPerWeek) setG({ ...g, availableWeekdays: [...g.availableWeekdays, d] });
  };

  const fallbackSummary = g.targetDate
    ? t("goal.summaryFallbackDate", { focus: t(`goal.goalFocus.${g.type}`), date: formatDate(g.targetDate), text: g.description })
    : t("goal.summaryFallback", { focus: t(`goal.goalFocus.${g.type}`), text: g.description });

  return (
    <Wizard
      step={stepIndex}
      total={steps.length}
      onBack={back}
      onNext={step === "summary" ? undefined : () => next()}
      nextDisabled={
        (step === "goal" && g.description.trim().length < 3) ||
        (step === "days" && g.availableWeekdays.length !== g.extraSessionsPerWeek) ||
        (step === "equipment" && g.equipment.length === 0)
      }
      hideNext={step === "summary" || step === "frequency" || step === "duration"}
    >
      {step === "goal" && (
        <>
          <WizardQuestion title={t("goal.step1Title")} hint={t("goal.step1Hint")} />
          <div className="flex flex-wrap gap-2">
            {GOAL_TYPES.map((type) => (
              <button key={type} type="button" onClick={() => setG({ ...g, type })} className={chip(g.type === type)}>
                {t(`goal.types.${type}`)}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("goal.description")}</span>
            <textarea
              rows={4}
              maxLength={500}
              value={g.description}
              placeholder={t("goal.descriptionPlaceholder")}
              onChange={(e) => setG({ ...g, description: e.target.value })}
              className="input resize-none"
            />
          </label>
        </>
      )}

      {step === "date" && (
        <>
          <WizardQuestion title={t("goal.stepDateTitle")} hint={t("goal.stepDateHint")} />
          <input
            type="date"
            value={g.targetDate ?? ""}
            onChange={(e) => setG({ ...g, targetDate: e.target.value || null })}
            className="input text-lg"
          />
          <button
            type="button"
            onClick={() => {
              const snapshot = { ...g, targetDate: null };
              setG(snapshot);
              next(snapshot);
            }}
            className="self-start text-sm text-muted underline underline-offset-4"
          >
            {t("goal.noDate")}
          </button>
        </>
      )}

      {step === "frequency" && (
        <>
          <WizardQuestion title={t("goal.step2Title")} hint={t("goal.step2Hint")} />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  const snapshot = { ...g, extraSessionsPerWeek: n, availableWeekdays: g.availableWeekdays.slice(0, n) };
                  setG(snapshot);
                  const list = stepsFor(snapshot, part);
                  goToIndex(list.indexOf(n === 0 ? "summary" : "days"), snapshot);
                }}
                className={`${chip(g.extraSessionsPerWeek === n)} py-5 font-display text-3xl font-bold`}
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
            title={g.extraSessionsPerWeek === 1 ? t("goal.step3TitleOne") : t("goal.step3TitleCount", { count: g.extraSessionsPerWeek })}
          />
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_ORDER.map((d) => {
              const active = g.availableWeekdays.includes(d);
              const full = !active && g.availableWeekdays.length >= g.extraSessionsPerWeek;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleDay(d)}
                  className={`${chip(active)} px-1 ${full ? "opacity-40" : ""}`}
                >
                  {t(`weekdays.short.${d}`)}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted">
            {t("goal.step3Count", { selected: g.availableWeekdays.length, count: g.extraSessionsPerWeek })}
          </p>
        </>
      )}

      {step === "duration" && (
        <>
          <WizardQuestion title={t("goal.step4Title")} />
          <div className="grid grid-cols-2 gap-2">
            {TIME_BUDGETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  const snapshot = { ...g, timeBudgetMin: m };
                  setG(snapshot);
                  next(snapshot);
                }}
                className={`${chip(g.timeBudgetMin === m)} py-5 font-display text-2xl font-bold`}
              >
                {t("goal.minutes", { value: m })}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "equipment" && (
        <>
          <WizardQuestion title={t("goal.step5Title")} note={t("goal.step5Hint")} />
          <div className="flex flex-col gap-2">
            {EQUIPMENT_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={g.equipment.includes(e)}
                onClick={() =>
                  setG({ ...g, equipment: g.equipment.includes(e) ? g.equipment.filter((x) => x !== e) : [...g.equipment, e] })
                }
                className={`${chip(g.equipment.includes(e))} text-left`}
              >
                {t(`goal.equipmentTypes.${e}`)}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "summary" && (
        <form action={action} className="flex flex-col gap-5">
          <input type="hidden" name="payload" value={JSON.stringify(g)} />
          <WizardQuestion title={t("goal.summaryTitle")} />

          <section className="card flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="eyebrow">{t("goal.summaryGoal")}</h3>
              {preview && !loading && (
                <span className="rounded border border-line px-1.5 font-display text-xs font-semibold uppercase text-muted">
                  {preview.source === "ai" ? t("goal.aiBadge") : t("goal.rulesBadge")}
                </span>
              )}
            </div>
            {loading ? (
              <p className="text-sm text-muted">{t("goal.summaryLoading")}</p>
            ) : (
              <p className="text-lg font-medium leading-snug">{g.aiSummary || fallbackSummary}</p>
            )}
            {!loading && preview && preview.focus.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {preview.focus.map((f) => (
                  <span key={f} className="rounded-md border border-line px-2 py-0.5 text-sm">
                    {f}
                  </span>
                ))}
              </div>
            )}
            <button type="button" onClick={() => go("goal")} className="self-start text-sm text-muted underline underline-offset-4">
              {t("goal.editStep")}
            </button>
          </section>

          <section className="card flex flex-col gap-2">
            <h3 className="eyebrow">{t("goal.summaryFrame")}</h3>
            <p>
              {g.extraSessionsPerWeek === 0
                ? t("goal.summaryNoExtra")
                : t("goal.summaryFrameText", {
                    sessions: g.extraSessionsPerWeek,
                    days: WEEKDAY_ORDER.filter((d) => g.availableWeekdays.includes(d))
                      .map((d) => t(`weekdays.short.${d}`))
                      .join(", "),
                    minutes: g.timeBudgetMin,
                    equipment: g.equipment.map((e) => t(`goal.equipmentTypes.${e}`)).join(", "),
                  })}
            </p>
            <button type="button" onClick={() => go("frequency")} className="self-start text-sm text-muted underline underline-offset-4">
              {t("goal.editStep")}
            </button>
          </section>

          <section className="card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold uppercase tracking-wide">{t("goal.target")}</h3>
              {g.type === "weight_loss" && (
                <Info title={t("goal.target")}>
                  <p>{t("goal.weightLossNote")}</p>
                </Info>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted">{t("goal.targetDateHint")}</span>
              <button type="button" onClick={() => go("date")} className="text-sm underline underline-offset-4">
                {g.targetDate ? formatDate(g.targetDate) : t("goal.noDate")}
              </button>
            </div>
            {g.testKey && (
              <TestCard
                testKey={g.testKey}
                onPickAlternative={(k) => setG({ ...g, testKey: k, unit: SELF_TESTS[k].unit, baselineValue: null, targetValue: null })}
                alternatives={tests.filter((x) => x.key !== g.testKey).map((x) => x.key)}
              />
            )}

            {g.testKey && (
              <div className="grid grid-cols-2 items-end gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="label flex items-center gap-1">
                    {t("goal.baselineHint")}
                    <Info title={t("goal.baselineHint")} className="-my-1">
                      <p>{t("goal.valuesOptional")}</p>
                    </Info>
                  </span>
                  <div className="flex items-center gap-2">
                    <input inputMode="decimal" defaultValue={g.baselineValue ?? ""} key={`b-${g.testKey}`} onChange={(e) => setG({ ...g, baselineValue: toNumber(e.target.value) })} className="input" />
                    <span className="text-sm text-muted">{SELF_TESTS[g.testKey].unit}</span>
                  </div>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">{t("goal.targetValueHint")}</span>
                  <div className="flex items-center gap-2">
                    <input inputMode="decimal" defaultValue={g.targetValue ?? ""} key={`z-${g.testKey}`} onChange={(e) => setG({ ...g, targetValue: toNumber(e.target.value) })} className="input" />
                    <span className="text-sm text-muted">{SELF_TESTS[g.testKey].unit}</span>
                  </div>
                </label>
              </div>
            )}
          </section>

          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          <button type="submit" disabled={pending || loading} className="btn-primary">
            {pending ? t("goal.saving") : t("goal.save")}
          </button>
        </form>
      )}
    </Wizard>
  );
}

function TestCard({
  testKey,
  alternatives,
  onPickAlternative,
}: {
  testKey: TestKey;
  alternatives: TestKey[];
  onPickAlternative: (k: TestKey) => void;
}) {
  const t = useT();
  const test = SELF_TESTS[testKey];
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm text-muted">{t("goal.testIntro")}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="font-display text-xl font-semibold">{t(`goal.tests.${testKey}.name`)}</p>
          <Info title={t(`goal.tests.${testKey}.name`)}>
            <p className="eyebrow text-xs">{t("goal.testHow")}</p>
            <p className="text-foreground">{t(`goal.tests.${testKey}.how`)}</p>
            <p className="eyebrow mt-2 text-xs">{t("goal.testWhy")}</p>
            <p>{t(`goal.tests.${testKey}.why`)}</p>
            {test.needs.length > 0 && (
              <p>{t("goal.testNeeds", { needs: test.needs.map((n) => t(`goal.equipmentTypes.${n}`)).join(", ") })}</p>
            )}
          </Info>
        </div>
      </div>
      {alternatives.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted">{t("goal.testAlternatives")}</p>
          <div className="flex flex-wrap gap-1.5">
            {alternatives.map((k) => (
              <button key={k} type="button" onClick={() => onPickAlternative(k)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-primary">
                {t(`goal.tests.${k}.name`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
