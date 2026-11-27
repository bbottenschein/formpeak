"use client";

import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { saveBodyMeasurement, type BodyState } from "./actions";

export function BodyForm({ weight, waist }: { weight: number | null; waist: number | null }) {
  const t = useT();
  const [state, action, pending] = useActionState<BodyState, FormData>(saveBodyMeasurement, {});
  return (
    <form action={action} className="card flex flex-col gap-3">
      <h2 className="eyebrow">{t("log.body")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("log.weight")}</span>
          <input name="weight" inputMode="decimal" defaultValue={weight ?? ""} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("log.waist")}</span>
          <input name="waist" inputMode="decimal" defaultValue={waist ?? ""} className="input" />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-sm text-primary">{t("log.bodySaved")}</p>}
      <button disabled={pending} className="btn-secondary">
        {t("log.bodySave")}
      </button>
    </form>
  );
}
