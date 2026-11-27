"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelSession } from "@/features/sessions/actions";
import { useT } from "@/lib/i18n/client";
import { postponeSession, swapSession } from "./session-actions";

const weekday = (d: string) =>
  new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** „Heute keine Zeit“ und „Lieber etwas anderes“ für einen Vorschlag. */
export function SessionChoices({ sessionId }: { sessionId: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"move" | "swap" | null>(null);
  const [message, setMessage] = useState<{ text: string; noDay?: boolean } | null>(null);

  const run = (kind: "move" | "swap") =>
    start(async () => {
      setBusy(kind);
      setMessage(null);
      if (kind === "move") {
        const res = await postponeSession(sessionId);
        setMessage(
          res.movedTo
            ? { text: t("plan.choices.moved", { day: weekday(res.movedTo) }) }
            : res.dropped
              ? { text: t("plan.choices.dropped") }
              : { text: t("plan.choices.noDay"), noDay: true },
        );
      } else {
        const res = await swapSession(sessionId);
        if (!res.ok) setMessage({ text: t("plan.choices.noAlternative") });
      }
      setBusy(null);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-3 text-sm">
        <button type="button" disabled={pending} onClick={() => run("move")} className="text-muted underline underline-offset-4 disabled:opacity-50">
          {busy === "move" ? t("plan.choices.moving") : t("plan.choices.move")}
        </button>
        <button type="button" disabled={pending} onClick={() => run("swap")} className="text-muted underline underline-offset-4 disabled:opacity-50">
          {busy === "swap" ? t("plan.choices.swapping") : t("plan.choices.swap")}
        </button>
      </div>
      {message && (
        <div className="flex items-center justify-between gap-3 text-sm" role="status">
          <span>{message.text}</span>
          {message.noDay && (
            <form action={cancelSession.bind(null, sessionId)}>
              <button className="text-danger underline underline-offset-4">{t("plan.choices.drop")}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
