"use client";

/** Skala 1–5 als fünf Tipp-Felder mit Beschriftung an den Enden. */
export function ScaleInput({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="eyebrow mb-2">{label}</legend>
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(n)}
              className={`h-12 rounded-lg border font-display text-xl font-semibold transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-line bg-surface text-foreground hover:border-muted/50"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </fieldset>
  );
}
