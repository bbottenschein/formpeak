"use client";

import Link from "next/link";
import { useRef } from "react";
import { useT } from "@/lib/i18n/client";
import { endOffseason } from "./actions";

/** Umschalter Season / Off-Season. Off-Season startet den Assistenten, Season fragt kurz nach. */
export function ModeToggle({ offseason }: { offseason: boolean }) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const base = "flex-1 rounded-md px-3 py-1.5 text-center font-display text-sm font-semibold uppercase tracking-wider transition";
  const on = `${base} bg-foreground text-background`;
  const off = `${base} text-muted hover:text-foreground`;
  return (
    <>
      <div role="group" aria-label={t("offseason.toggleLabel")} className="flex gap-1 rounded-lg border border-line p-1">
        {offseason ? (
          <button type="button" className={off} onClick={() => dialog.current?.showModal()}>
            {t("offseason.season")}
          </button>
        ) : (
          <span className={on} aria-current="true">
            {t("offseason.season")}
          </span>
        )}
        {offseason ? (
          <span className={on} aria-current="true">
            {t("offseason.off")}
          </span>
        ) : (
          <Link href="/offseason" className={off}>
            {t("offseason.off")}
          </Link>
        )}
      </div>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-0 mt-auto w-full max-w-none border-t border-line bg-surface p-0 text-foreground backdrop:bg-black/60"
      >
        <form action={endOffseason} className="mx-auto flex max-w-lg flex-col gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5">
          <p className="font-display text-xl font-semibold">{t("offseason.endTitle")}</p>
          <p className="text-sm text-muted">{t("offseason.endText")}</p>
          <button className="btn-primary mt-2">{t("offseason.endConfirm")}</button>
          <button type="button" className="btn-secondary" onClick={() => dialog.current?.close()}>
            {t("common.back")}
          </button>
        </form>
      </dialog>
    </>
  );
}
