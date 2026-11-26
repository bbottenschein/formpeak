"use client";

import { useActionState } from "react";
import { logout } from "@/features/auth/actions";
import { useT } from "@/lib/i18n/client";
import { giveConsent, type PrivacyState } from "./actions";

export function ConsentForm() {
  const t = useT();
  const [state, action, pending] = useActionState<PrivacyState>(giveConsent, {});
  return (
    <div className="flex flex-col gap-4">
      <p className="card text-sm">{t("invite.consentLabel")}</p>
      <p className="text-xs text-muted">{t("invite.noDiagnosis")}</p>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <form action={action}>
        <button disabled={pending} className="btn-primary w-full">
          {pending ? t("consent.pending") : t("consent.accept")}
        </button>
      </form>
      <form action={logout}>
        <button className="w-full text-sm text-muted underline underline-offset-4">{t("consent.decline")}</button>
      </form>
    </div>
  );
}
