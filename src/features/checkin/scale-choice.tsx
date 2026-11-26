"use client";

/**
 * Große 1–5-Auswahl für Walk-Throughs: Antippen wählt und schaltet nach einem kurzen
 * Moment weiter, damit man die Auswahl noch sieht.
 */
export function ScaleChoice({
  value,
  onPick,
  lowLabel,
  highLabel,
}: {
  value: number | null;
  onPick: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-5 gap-2" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={String(n)}
            onClick={() => onPick(n)}
            className={`h-20 rounded-xl border font-display text-3xl font-bold transition ${
              value === n ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface hover:border-muted/50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-sm text-muted">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

/** Kurze Verzögerung vor dem Weiterschalten nach einer Auswahl. */
export const ADVANCE_DELAY_MS = 180;
