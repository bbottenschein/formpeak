"use client";

import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { deleteAccount, type PrivacyState } from "./actions";

export function DeleteAccountForm() {
  const t = useT();
  const [state, action, pending] = useActionState<PrivacyState, FormData>(deleteAccount, {});
  return (
    <details className="px-4 py-3.5">
      <summary className="cursor-pointer text-danger">{t("privacy.deleteTitle")}</summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-muted">{t("privacy.deleteText")}</p>
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("privacy.deleteConfirmLabel")}</span>
          <input name="confirm" autoComplete="off" className="input" />
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <button disabled={pending} className="btn-secondary border-danger/60 text-danger">
          {pending ? t("privacy.deletePending") : t("privacy.deleteSubmit")}
        </button>
      </form>
    </details>
  );
}
