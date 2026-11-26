"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * Rahmen für Schritt-für-Schritt-Abläufe (Check-ins, Ziel): Fortschrittsbalken,
 * eine Frage pro Bildschirm, Zurück und Weiter. Der Inhalt steuert, wann es weitergeht.
 */
export function Wizard({
  step,
  total,
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
  hideNext = false,
  nextVariant = "primary",
  children,
}: {
  step: number;
  total: number;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** z. B. bei Skalen, die beim Antippen selbst weiterschalten. */
  hideNext?: boolean;
  /** „secondary“ für Überspringen, wenn im Schritt selbst eine Hauptaktion steht. */
  nextVariant?: "primary" | "secondary";
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex min-h-[60dvh] flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          aria-label={t("common.back")}
          className="text-xl text-muted disabled:invisible"
        >
          ←
        </button>
        <div className="flex flex-1 gap-1" aria-label={t("wizard.progress", { step: step + 1, total })}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-line"}`} />
          ))}
        </div>
        <span className="w-10 text-right font-display text-sm tabular-nums text-muted">
          {step + 1}/{total}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-5">{children}</div>

      {!hideNext && onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className={nextVariant === "primary" ? "btn-primary" : "btn-secondary"}
        >
          {nextLabel ?? t("wizard.next")}
        </button>
      )}
    </div>
  );
}

/** Große Frage oben im Schritt. */
export function WizardQuestion({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-3xl font-bold leading-tight">{title}</h2>
      {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}
    </div>
  );
}
