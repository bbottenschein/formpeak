"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { saveEveningCheckin, type CheckinState } from "./actions";
import { ScaleInput } from "./scale-input";
import type { EveningCheckinInput } from "./schema";

export function EveningForm({ initial }: { initial: EveningCheckinInput }) {
  const t = useT();
  const [v, setV] = useState<EveningCheckinInput>(initial);
  const [state, action, pending] = useActionState<CheckinState, FormData>(saveEveningCheckin, {});

  return (
    <form action={action} className="flex flex-col gap-7">
      <input type="hidden" name="payload" value={JSON.stringify(v)} />

      <div className="flex flex-col gap-1">
        <ScaleInput
          label={t("evening.dailyLoad")}
          value={v.dailyLoad}
          onChange={(dailyLoad) => setV({ ...v, dailyLoad })}
          lowLabel={t("evening.dailyLoadLow")}
          highLabel={t("evening.dailyLoadHigh")}
        />
        <p className="text-xs text-muted">{t("evening.dailyLoadHint")}</p>
      </div>
      <ScaleInput
        label={t("evening.stress")}
        value={v.stress}
        onChange={(stress) => setV({ ...v, stress })}
        lowLabel={t("evening.stressLow")}
        highLabel={t("evening.stressHigh")}
      />
      <ScaleInput
        label={t("evening.energy")}
        value={v.energy}
        onChange={(energy) => setV({ ...v, energy })}
        lowLabel={t("evening.energyLow")}
        highLabel={t("evening.energyHigh")}
      />

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
          rows={2}
          maxLength={500}
          value={v.note ?? ""}
          placeholder={t("evening.notePlaceholder")}
          onChange={(e) => setV({ ...v, note: e.target.value || null })}
          className="input resize-none"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t("evening.pending") : t("evening.submit")}
      </button>
    </form>
  );
}
