"use client";

import { useActionState, useState } from "react";
import { Wizard, WizardQuestion } from "@/features/shell/wizard";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveEveningCheckin, type CheckinState } from "./actions";
import { ADVANCE_DELAY_MS, ScaleChoice } from "./scale-choice";
import type { EveningCheckinInput } from "./schema";

type Scale = "dailyLoad" | "stress" | "energy";
const STEPS = ["dailyLoad", "stress", "energy", "extras", "summary"] as const;
type Step = (typeof STEPS)[number];

const LABELS: Record<Scale, [MessageKey, MessageKey]> = {
  dailyLoad: ["evening.dailyLoadLow", "evening.dailyLoadHigh"],
  stress: ["evening.stressLow", "evening.stressHigh"],
  energy: ["evening.energyLow", "evening.energyHigh"],
};

/** Abend-Check-in als Walk-Through. */
export function EveningForm({ initial }: { initial: EveningCheckinInput }) {
  const t = useT();
  const [v, setV] = useState<EveningCheckinInput>(initial);
  const [index, setIndex] = useState(0);
  const [state, action, pending] = useActionState<CheckinState, FormData>(saveEveningCheckin, {});
  const step: Step = STEPS[index];
  const next = () => setIndex((i) => Math.min(i + 1, STEPS.length - 1));

  return (
    <Wizard
      step={index}
      total={STEPS.length}
      onBack={index > 0 ? () => setIndex((i) => i - 1) : undefined}
      onNext={next}
      hideNext={step !== "extras"}
    >
      {(step === "dailyLoad" || step === "stress" || step === "energy") && (
        <>
          <WizardQuestion title={t(`evening.q.${step}`)} hint={step === "dailyLoad" ? t("evening.dailyLoadHint") : undefined} />
          <ScaleChoice
            value={v[step]}
            onPick={(n) => {
              setV((prev) => ({ ...prev, [step]: n }));
              setTimeout(next, ADVANCE_DELAY_MS);
            }}
            lowLabel={t(LABELS[step][0])}
            highLabel={t(LABELS[step][1])}
          />
        </>
      )}

      {step === "extras" && (
        <>
          <WizardQuestion title={t("evening.q.extras")} />
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">
              {t("evening.steps")} <span className="normal-case tracking-normal text-muted/70">· {t("common.optional")}</span>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={200000}
              step={100}
              value={v.steps ?? ""}
              onChange={(e) => setV({ ...v, steps: e.target.value === "" ? null : Math.round(Number(e.target.value)) })}
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">
              {t("evening.note")} <span className="normal-case tracking-normal text-muted/70">· {t("common.optional")}</span>
            </span>
            <textarea
              rows={3}
              maxLength={500}
              value={v.note ?? ""}
              placeholder={t("evening.notePlaceholder")}
              onChange={(e) => setV({ ...v, note: e.target.value || null })}
              className="input resize-none"
            />
          </label>
        </>
      )}

      {step === "summary" && (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="payload" value={JSON.stringify(v)} />
          <WizardQuestion title={t("evening.summaryTitle")} />
          <ul className="card flex flex-col divide-y divide-line py-1">
            {(
              [
                [0, t("evening.dailyLoad"), String(v.dailyLoad)],
                [1, t("evening.stress"), String(v.stress)],
                [2, t("evening.energy"), String(v.energy)],
                [3, t("evening.steps"), v.steps != null ? v.steps.toLocaleString("de-DE") : "–"],
                [3, t("evening.note"), v.note ?? "–"],
              ] as [number, string, string][]
            ).map(([i, label, value]) => (
              <li key={label}>
                <button type="button" onClick={() => setIndex(i)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                  <span className="text-muted">{label}</span>
                  <span className="max-w-[60%] truncate font-display text-lg font-semibold">{value}</span>
                </button>
              </li>
            ))}
          </ul>
          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? t("evening.pending") : t("evening.submit")}
          </button>
        </form>
      )}
    </Wizard>
  );
}
