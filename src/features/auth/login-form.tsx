"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { login, sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const t = useT();
  const [mode, setMode] = useState<"password" | "link">("password");
  const [loginState, loginAction, loginPending] = useActionState<LoginState, FormData>(login, {
    error: initialError,
  });
  const [linkState, linkAction, linkPending] = useActionState<LoginState, FormData>(
    sendMagicLink,
    {},
  );

  const state = mode === "password" ? loginState : linkState;
  const pending = mode === "password" ? loginPending : linkPending;

  return (
    <form action={mode === "password" ? loginAction : linkAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="label">{t("common.email")}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.email}
          required
          className="input"
        />
      </label>

      {mode === "password" && (
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("common.password")}</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
          />
        </label>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.info && (
        <p role="status" className="text-sm text-muted">
          {state.info}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary mt-2">
        {mode === "password"
          ? pending
            ? t("auth.loginPending")
            : t("auth.loginSubmit")
          : pending
            ? t("auth.magicLinkPending")
            : t("auth.magicLinkSubmit")}
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "password" ? "link" : "password")}
        className="text-sm text-muted underline underline-offset-4"
      >
        {mode === "password" ? t("auth.magicLinkToggle") : t("auth.passwordToggle")}
      </button>
    </form>
  );
}
