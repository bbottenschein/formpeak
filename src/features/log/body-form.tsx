"use client";

import { useActionState } from "react";
import { Info } from "@/features/ui/info";
import { useT } from "@/lib/i18n/client";
import { saveBodyMeasurement, type BodyState } from "./actions";

export function BodyForm({ weight, waist }: { weight: number | null; waist: number | null }) {
  const t = useT();
  const [state, action, pending] = useActionState<BodyState, FormData>(saveBodyMeasurement, {});
  return (
    <form action={action} className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">{t("log.body")}</h2>
        <Info title={t("log.body")} className="-my-1">
          <p>{t("log.bodyInfo")}</p>
        </Info>
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("log.weight")}</span>
          <input name="weight" inputMode="decimal" defaultValue={weight ?? ""} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("log.waist")}</span>
          <input name="waist" inputMode="decimal" defaultValue={waist ?? ""} className="input" />
        </label>
        <button disabled={pending} className="btn-secondary">
          {state.ok ? t("log.bodySaved") : t("log.bodySave")}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
