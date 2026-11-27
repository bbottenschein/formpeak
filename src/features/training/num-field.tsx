"use client";

import { useState } from "react";

/**
 * Zahlenfeld, das sich frei leeren und tippen lässt (keine hängende „0“), Komma oder Punkt.
 * Gibt null zurück, solange das Feld leer ist.
 */
export function NumField({
  value,
  onChange,
  decimal = false,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  decimal?: boolean;
  label: string;
}) {
  const fmt = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
  const [raw, setRaw] = useState(fmt(value));
  const [last, setLast] = useState(value);
  // Wert von außen geändert (z. B. Satz hinzugefügt) → Anzeige nachziehen.
  if (value !== last) {
    setLast(value);
    if (Number(raw.replace(",", ".")) !== value) setRaw(fmt(value));
  }
  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      aria-label={label}
      value={raw}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const text = e.target.value.replace(decimal ? /[^\d.,]/g : /\D/g, "");
        setRaw(text);
        const n = Number(text.replace(",", "."));
        const next = text === "" || !Number.isFinite(n) ? null : decimal ? Math.round(n * 2) / 2 : Math.round(n);
        setLast(next);
        onChange(next);
      }}
      className="input text-center"
    />
  );
}
