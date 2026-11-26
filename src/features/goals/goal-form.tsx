"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { saveGoal, type GoalState } from "./actions";
import { EQUIPMENT_OPTIONS, GOAL_TYPES, TEST_PRESETS, TIME_BUDGETS, type GoalInput } from "./schema";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
type Preset = keyof typeof TEST_PRESETS | "custom";

const chip = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-sm font-medium transition ${
    active ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface hover:border-muted/50"
  }`;

const toNumber = (raw: string) => {
  const n = Number(raw.replace(",", "."));
  return raw.trim() === "" || !Number.isFinite(n) ? null : n;
};

export function GoalForm({ initial }: { initial: GoalInput }) {
  const t = useT();
  const [g, setG] = useState<GoalInput>(initial);
  const [state, action, pending] = useActionState<GoalState, FormData>(saveGoal, {});
  const presetName = (p: Preset) => (p === "custom" ? "" : t(`goal.testPresets.${p}`));
  const [preset, setPreset] = useState<Preset | null>(() => {
    if (!initial.testName) return null;
    const match = (Object.keys(TEST_PRESETS) as (keyof typeof TEST_PRESETS)[]).find((p) => presetName(p) === initial.testName);
    return match ?? "custom";
  });
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function choosePreset(p: Preset) {
    if (preset === p) {
      setPreset(null);
      setG({ ...g, testName: null, baselineValue: null, targetValue: null, unit: null });
      return;
    }
    setPreset(p);
    setG({ ...g, testName: presetName(p) || null, unit: p === "custom" ? g.unit : TEST_PRESETS[p].unit });
  }

  return (
    <form action={action} className="flex flex-col gap-7">
      <input type="hidden" name="payload" value={JSON.stringify(g)} />

      <fieldset className="flex flex-col gap-2">
        <legend className="eyebrow mb-2">{t("goal.type")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_TYPES.map((type) => (
            <button key={type} type="button" onClick={() => setG({ ...g, type })} className={chip(g.type === type)}>
              {t(`goal.types.${type}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">{t("goal.description")}</span>
        <textarea
          rows={3}
          maxLength={500}
          value={g.description}
          placeholder={t("goal.descriptionPlaceholder")}
          onChange={(e) => setG({ ...g, description: e.target.value })}
          className="input resize-none"
          required
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="eyebrow mb-1">{t("goal.test")}</legend>
        <p className="text-xs text-muted">{t("goal.testHint")}</p>
        <div className="flex flex-wrap gap-1.5">
          {(["yoyo", "run3k", "sprint30", "custom"] as Preset[]).map((p) => (
            <button key={p} type="button" onClick={() => choosePreset(p)} className={chip(preset === p)}>
              {t(`goal.testPresets.${p}`)}
            </button>
          ))}
        </div>
        {preset && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {preset === "custom" && (
              <label className="col-span-2 flex flex-col gap-1.5">
                <span className="label">{t("goal.testName")}</span>
                <input value={g.testName ?? ""} maxLength={60} onChange={(e) => setG({ ...g, testName: e.target.value || null })} className="input" />
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="label">{t("goal.baseline")}</span>
              <input inputMode="decimal" defaultValue={g.baselineValue ?? ""} onChange={(e) => setG({ ...g, baselineValue: toNumber(e.target.value) })} className="input" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">{t("goal.target")}</span>
              <input inputMode="decimal" defaultValue={g.targetValue ?? ""} onChange={(e) => setG({ ...g, targetValue: toNumber(e.target.value) })} className="input" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">{t("goal.unit")}</span>
              <input value={g.unit ?? ""} maxLength={20} onChange={(e) => setG({ ...g, unit: e.target.value || null })} className="input" />
            </label>
          </div>
        )}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">
          {t("goal.targetDate")} <span className="normal-case tracking-normal text-muted/70">· {t("common.optional")}</span>
        </span>
        <input type="date" value={g.targetDate ?? ""} onChange={(e) => setG({ ...g, targetDate: e.target.value || null })} className="input" />
      </label>

      <div className="flex flex-col gap-6 border-t border-line pt-6">
        <h2 className="text-2xl font-bold">{t("goal.frame")}</h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="eyebrow mb-2">{t("goal.sessionsPerWeek")}</legend>
          <div className="grid grid-cols-6 gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setG({ ...g, extraSessionsPerWeek: n })} className={`${chip(g.extraSessionsPerWeek === n)} font-display text-lg`}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="eyebrow mb-2">{t("goal.timeBudget")}</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {TIME_BUDGETS.map((m) => (
              <button key={m} type="button" onClick={() => setG({ ...g, timeBudgetMin: m })} className={chip(g.timeBudgetMin === m)}>
                {t("goal.minutes", { value: m })}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="eyebrow mb-2">{t("goal.weekdays")}</legend>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={g.availableWeekdays.includes(d)}
                onClick={() => setG({ ...g, availableWeekdays: toggle(g.availableWeekdays, d) })}
                className={`${chip(g.availableWeekdays.includes(d))} px-1`}
              >
                {t(`weekdays.short.${d}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="eyebrow mb-2">{t("goal.equipment")}</legend>
          <div className="flex flex-col gap-1.5">
            {EQUIPMENT_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={g.equipment.includes(e)}
                onClick={() => setG({ ...g, equipment: toggle(g.equipment, e) })}
                className={`${chip(g.equipment.includes(e))} text-left`}
              >
                {t(`goal.equipmentTypes.${e}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t("goal.saving") : t("goal.save")}
      </button>
    </form>
  );
}
