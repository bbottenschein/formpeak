"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { chatCoach, type ChatMessage } from "./actions";

const STORE = "formpeak:coach";

/**
 * KI-Chat unten rechts: Fragen stellen oder das heutige Training ändern lassen
 * („Beinpresse ist belegt“). Der Verlauf bleibt bis zum Schließen der App erhalten.
 */
export function CoachChat() {
  const t = useT();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      return typeof window === "undefined" ? [] : (JSON.parse(sessionStorage.getItem(STORE) ?? "[]") as ChatMessage[]);
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-20)));
    } catch {}
    end.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = (text: string) => {
    const content = text.trim();
    if (!content || pending) return;
    const history: ChatMessage[] = [...messages, { role: "user" as const, content }].slice(-20);
    // Verlauf muss mit einer Nutzernachricht beginnen.
    while (history.length && history[0].role !== "user") history.shift();
    setMessages(history);
    setDraft("");
    setError(false);
    start(async () => {
      try {
        const res = await chatCoach(history);
        if (!res.reply) setError(true);
        else setMessages([...history, { role: "assistant", content: res.reply }]);
        if (res.changed) router.refresh();
      } catch {
        setError(true);
      }
    });
  };

  const suggestions = [t("coach.example1"), t("coach.example2"), t("coach.example3")];

  return (
    <>
      <button
        type="button"
        aria-label={t("coach.open")}
        onClick={() => dialog.current?.showModal()}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-4 z-20 flex size-12 items-center justify-center rounded-full border border-line bg-surface-raised text-foreground shadow-sm transition hover:border-primary"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M5 18l-1.5 3.5L8 20h8a4 4 0 004-4V8a4 4 0 00-4-4H8a4 4 0 00-4 4v8c0 .7.2 1.4.5 2" strokeLinejoin="round" />
          <path d="M9 10.5h6M9 14h4" strokeLinecap="round" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-0 mt-auto h-[85dvh] max-h-[85dvh] w-full max-w-none border-t border-line bg-surface p-0 text-foreground backdrop:bg-black/60"
      >
        <div className="mx-auto flex h-full max-w-lg flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-xl font-semibold">{t("coach.title")}</p>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button type="button" onClick={() => setMessages([])} className="text-sm text-muted underline underline-offset-4">
                  {t("coach.clear")}
                </button>
              )}
              <button type="button" aria-label={t("common.back")} onClick={() => dialog.current?.close()} className="text-muted">
                <svg viewBox="0 0 20 20" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted">{t("coach.intro")}</p>
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="self-start rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-muted/50">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <p
                key={i}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user" ? "self-end bg-surface-raised" : "self-start border border-line"
                }`}
              >
                {m.content}
              </p>
            ))}
            {pending && <p className="self-start text-sm text-muted">{t("coach.thinking")}</p>}
            {error && <p className="self-start text-sm text-danger">{t("coach.error")}</p>}
            <div ref={end} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("coach.placeholder")}
              maxLength={2000}
              className="input flex-1"
              aria-label={t("coach.placeholder")}
            />
            <button type="submit" disabled={pending || !draft.trim()} className="btn-primary px-4">
              {t("coach.send")}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
