"use client";

import { useActionState, useState } from "react";
import { PainPicker } from "@/features/bodymap/pain-picker";
import { Wizard, WizardQuestion } from "@/features/shell/wizard";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveMorningCheckin, type CheckinState } from "./actions";
import { PulseTimer } from "./pulse-timer";
import { ADVANCE_DELAY_MS, ScaleChoice } from "./scale-choice";
import type { MorningCheckinInput } from "./schema";

type Scale = "sleepQuality" | "energy" | "soreness" | "stress";
const STEPS = ["sleepHours", "sleepQuality", "energy", "soreness", "stress", "restingHr", "pain", "summary"] as const;
type Step = (typeof STEPS)[number];

const SCALE_LABELS: Record<Scale, [MessageKey, MessageKey]> = {
  sleepQuality: ["checkin.scaleSleepQualityLow", "checkin.scaleSleepQualityHigh"],
  energy: ["checkin.scaleEnergyLow", "checkin.scaleEnergyHigh"],
  soreness: ["checkin.scaleSorenessLow", "checkin.scaleSorenessHigh"],
  stress: ["checkin.scaleStressLow", "checkin.scaleStressHigh"],
};

/** Morgen-Check-in als Walk-Through: eine Frage pro Bildschirm, Skalen schalten beim Antippen weiter. */
export function MorningForm({ initial }: { initial: MorningCheckinInput }) {
  const t = useT();
  const [v, setV] = useState<MorningCheckinInput>(initial);
  const [index, setIndex] = useState(0);
  const [painOpen, setPainOpen] = useState(initial.pains.length > 0);
  const [state, action, pending] = useActionState<CheckinState, FormData>(saveMorningCheckin, {});
  const step: Step = STEPS[index];
  const next = () => setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const goTo = (s: Step) => setIndex(STEPS.indexOf(s));

  function pickScale(key: Scale, value: number) {
    setV((prev) => ({ ...prev, [key]: value }));
    setTimeout(next, ADVANCE_DELAY_MS);
  }

  const painLabel = (p: MorningCheckinInput["pains"][number]) =>
    `${t(`bodymap.regions.${p.region}`)}${p.side === "center" ? "" : ` ${t(`bodymap.sides.${p.side}`)}`} (${p.intensity})`;

  return (
    <Wizard
      step={index}
      total={STEPS.length}
      onBack={index > 0 ? () => setIndex((i) => i - 1) : undefined}
      onNext={next}
      hideNext={step === "summary" || step === "sleepQuality" || step === "energy" || step === "soreness" || step === "stress" || (step === "pain" && !painOpen)}
      nextLabel={step === "restingHr" && v.restingHr == null ? t("checkin.restingHrSkip") : undefined}
      nextVariant={step === "restingHr" && v.restingHr == null ? "secondary" : "primary"}
    >
      {step === "sleepHours" && (
        <>
          <WizardQuestion title={t("checkin.q.sleepHours")} />
          <output className="text-center font-display text-7xl font-bold tabular-nums">
            {t("checkin.hoursValue", { hours: v.sleepHours.toLocaleString("de-DE") })}
          </output>
          <input
            type="range"
            min={3}
            max={12}
            step={0.5}
            value={v.sleepHours}
            onChange={(e) => setV({ ...v, sleepHours: Number(e.target.value) })}
            className="w-full accent-primary"
            aria-label={t("checkin.sleepHours")}
          />
        </>
      )}

      {(step === "sleepQuality" || step === "energy" || step === "soreness" || step === "stress") && (
        <>
          <WizardQuestion title={t(`checkin.q.${step}`)} />
          <ScaleChoice
            value={v[step]}
            onPick={(n) => pickScale(step, n)}
            lowLabel={t(SCALE_LABELS[step][0])}
            highLabel={t(SCALE_LABELS[step][1])}
          />
        </>
      )}

      {step === "restingHr" && (
        <>
          <WizardQuestion title={t("checkin.q.restingHr")} hint={t("checkin.restingHrHint")} />
          <PulseTimer compact value={v.restingHr} onChange={(restingHr) => setV({ ...v, restingHr })} />
        </>
      )}

      {step === "pain" && (
        <>
          <WizardQuestion title={t("checkin.q.pain")} />
          {painOpen ? (
            <PainPicker value={v.pains} onChange={(pains) => setV({ ...v, pains })} />
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setV({ ...v, pains: [] });
                  next();
                }}
                className="btn-primary"
              >
                {t("checkin.painNoneButton")}
              </button>
              <button type="button" onClick={() => setPainOpen(true)} className="btn-secondary">
                {t("checkin.painYes")}
              </button>
            </div>
          )}
        </>
      )}

      {step === "summary" && (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="payload" value={JSON.stringify(v)} />
          <WizardQuestion title={t("checkin.summaryTitle")} />
          <ul className="card flex flex-col divide-y divide-line py-1">
            {(
              [
                ["sleepHours", t("checkin.sleepHours"), t("checkin.hoursValue", { hours: v.sleepHours.toLocaleString("de-DE") })],
                ["sleepQuality", t("checkin.sleepQuality"), String(v.sleepQuality)],
                ["energy", t("checkin.energy"), String(v.energy)],
                ["soreness", t("checkin.soreness"), String(v.soreness)],
                ["stress", t("checkin.stress"), String(v.stress)],
                ["restingHr", t("checkin.restingHr"), v.restingHr != null ? `${v.restingHr}` : t("checkin.summaryNotMeasured")],
                ["pain", t("checkin.pain"), v.pains.length ? v.pains.map(painLabel).join(", ") : t("checkin.summaryNoPain")],
              ] as [Step, string, string][]
            ).map(([key, label, value]) => (
              <li key={key}>
                <button type="button" onClick={() => goTo(key)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                  <span className="text-muted">{label}</span>
                  <span className="font-display text-lg font-semibold">{value}</span>
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
            {pending ? t("checkin.pending") : t("checkin.submit")}
          </button>
        </form>
      )}
    </Wizard>
  );
}
