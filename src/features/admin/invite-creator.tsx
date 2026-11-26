"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createInvitation, type CreateInviteState } from "./actions";

export function InviteCreator() {
  const t = useT();
  const [state, action, pending] = useActionState<CreateInviteState, FormData>(createInvitation, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("admin.note")}</span>
          <input name="note" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("admin.emailOptional")}</span>
          <input name="email" type="email" inputMode="email" className="input" />
        </label>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? t("admin.creating") : t("admin.create")}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.link && (
        <div className="card flex flex-col gap-2">
          <span className="text-sm font-medium">{t("admin.created")}</span>
          <code className="break-all text-sm">{state.link}</code>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(state.link!);
              setCopied(true);
            }}
          >
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
      )}
    </div>
  );
}
