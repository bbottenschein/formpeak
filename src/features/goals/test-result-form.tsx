"use client";

import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { recordTestResult, type TestResultState } from "./actions";

/** Ergebnis eines Referenztests eintragen. */
export function TestResultForm({ testId, unit }: { testId: string; unit: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<TestResultState, FormData>(recordTestResult.bind(null, testId), {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="label">{t("goalView.resultLabel", { unit })}</span>
        <div className="flex gap-2">
          <input name="value" inputMode="decimal" required className="input" />
          <button disabled={pending} className="btn-primary shrink-0 px-5 py-2.5 text-base">
            {pending ? t("goalView.saving") : t("goalView.save")}
          </button>
        </div>
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
