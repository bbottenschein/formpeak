"use client";

import { useRef } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * Info-Symbol: Erklärungen stehen nicht dauerhaft im Bild, sondern öffnen sich auf Tipp
 * als Blatt von unten. So bleiben die Seiten ruhig und trotzdem selbsterklärend.
 */
export function Info({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        aria-label={`${t("common.info")}: ${title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          ref.current?.showModal();
        }}
        className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground ${className}`}
      >
        <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <circle cx="10" cy="10" r="8.2" />
          <path d="M10 9v5" strokeLinecap="round" />
          <circle cx="10" cy="6.3" r="0.4" fill="currentColor" />
        </svg>
      </button>
      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-0 mt-auto w-full max-w-none border-t border-line bg-surface p-0 text-foreground backdrop:bg-black/60"
      >
        <div className="mx-auto flex max-w-lg flex-col gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5">
          <p className="font-display text-xl font-semibold">{title}</p>
          <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted">{children}</div>
          <button type="button" className="btn-secondary mt-2" onClick={() => ref.current?.close()}>
            {t("common.gotIt")}
          </button>
        </div>
      </dialog>
    </>
  );
}
