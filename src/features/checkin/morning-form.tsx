"use client";

import { useActionState, useState } from "react";
import { PainPicker } from "@/features/bodymap/pain-picker";
import { useT } from "@/lib/i18n/client";
import { saveMorningCheckin, type CheckinState } from "./actions";
import { PulseTimer } from "./pulse-timer";
import { ScaleInput } from "./scale-input";
import type { MorningCheckinInput } from "./schema";

export function MorningForm({ initial }: { initial: MorningCheckinInput }) {
  const t = useT();
  const [values, setValues] = useState<MorningCheckinInput>(initial);
  const [state, action, pending] = useActionState<CheckinState, FormData>(saveMorningCheckin, {});
  const set = <K extends keyof MorningCheckinInput>(key: K) => (v: MorningCheckinInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <form action={action} className="flex flex-col gap-7">
      <input type="hidden" name="payload" value={JSON.stringify(values)} />

      <fieldset className="flex flex-col gap-2">
        <legend className="eyebrow mb-2">{t("checkin.sleepHours")}</legend>
        <div className="flex items-baseline justify-between">
          <output className="font-display text-4xl font-bold tabular-nums">
            {t("checkin.hoursValue", { hours: values.sleepHours.toLocaleString("de-DE") })}
          </output>
        </div>
        <input
          type="range"
          min={3}
          max={12}
          step={0.5}
          value={values.sleepHours}
          onChange={(e) => set("sleepHours")(Number(e.target.value))}
          className="w-full accent-primary"
          aria-label={t("checkin.sleepHours")}
        />
      </fieldset>

      <ScaleInput
        label={t("checkin.sleepQuality")}
        value={values.sleepQuality}
        onChange={set("sleepQuality")}
        lowLabel={t("checkin.scaleSleepQualityLow")}
        highLabel={t("checkin.scaleSleepQualityHigh")}
      />
      <ScaleInput
        label={t("checkin.energy")}
        value={values.energy}
        onChange={set("energy")}
        lowLabel={t("checkin.scaleEnergyLow")}
        highLabel={t("checkin.scaleEnergyHigh")}
      />
      <ScaleInput
        label={t("checkin.soreness")}
        value={values.soreness}
        onChange={set("soreness")}
        lowLabel={t("checkin.scaleSorenessLow")}
        highLabel={t("checkin.scaleSorenessHigh")}
      />
      <ScaleInput
        label={t("checkin.stress")}
        value={values.stress}
        onChange={set("stress")}
        lowLabel={t("checkin.scaleStressLow")}
        highLabel={t("checkin.scaleStressHigh")}
      />

      <PulseTimer value={values.restingHr} onChange={set("restingHr")} />
      <PainPicker value={values.pains} onChange={set("pains")} />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-background/95 px-4 py-3">
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? t("checkin.pending") : t("checkin.submit")}
        </button>
      </div>
    </form>
  );
}
