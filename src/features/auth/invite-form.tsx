"use client";

import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { redeemInvite, type InviteState } from "./invite";

export function InviteForm({ code, presetEmail }: { code: string; presetEmail: string | null }) {
  const t = useT();
  const [state, action, pending] = useActionState<InviteState, FormData>(
    redeemInvite.bind(null, code),
    { email: presetEmail ?? undefined },
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="label">{t("common.name")}</span>
        <input name="name" autoComplete="given-name" defaultValue={state.name} required className="input" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">{t("common.email")}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.email}
          readOnly={Boolean(presetEmail)}
          required
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">{t("common.password")}</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="input"
        />
        <span className="text-xs text-muted">{t("invite.passwordHint")}</span>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input name="consent" type="checkbox" required className="mt-1 size-4 shrink-0 accent-primary" />
        <span>{t("invite.consentLabel")}</span>
      </label>
      <p className="text-xs text-muted">{t("invite.noDiagnosis")}</p>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary mt-2">
        {pending ? t("invite.pending") : t("invite.submit")}
      </button>
    </form>
  );
}
