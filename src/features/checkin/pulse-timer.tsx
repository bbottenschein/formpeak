"use client";

import { useEffect, useRef, useState } from "react";
import { restingHrFromCount } from "@/core/load";
import { useT } from "@/lib/i18n/client";

const SECONDS = 10;

/**
 * Ruhepuls per 10-Sekunden-Zählung: Timer starten, zählen, Zahl eintragen – die App
 * rechnet × 6. Am Ende vibriert das Handy (falls unterstützt).
 */
export function PulseTimer({
  value,
  onChange,
  compact = false,
}: {
  value: number | null;
  onChange: (bpm: number | null) => void;
  /** Im Walk-Through: ohne eigene Überschrift und Hinweis, Messen-Button hervorgehoben. */
  compact?: boolean;
}) {
  const t = useT();
  const [phase, setPhase] = useState<"idle" | "running" | "count">(value != null ? "count" : "idle");
  const [left, setLeft] = useState(SECONDS);
  const [count, setCount] = useState<string>(value != null ? String(value / 6) : "");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  function start() {
    setPhase("running");
    setLeft(SECONDS);
    const startedAt = Date.now();
    timer.current = setInterval(() => {
      const remaining = SECONDS - Math.floor((Date.now() - startedAt) / 1000);
      if (remaining <= 0) {
        if (timer.current) clearInterval(timer.current);
        navigator.vibrate?.(200);
        setPhase("count");
        setLeft(0);
      } else {
        setLeft(remaining);
      }
    }, 100);
  }

  function updateCount(raw: string) {
    setCount(raw);
    const n = Number(raw);
    onChange(raw !== "" && Number.isInteger(n) && n >= 4 && n <= 40 ? restingHrFromCount(n) : null);
  }

  function reset() {
    if (timer.current) clearInterval(timer.current);
    setPhase("idle");
    setCount("");
    onChange(null);
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={compact ? "sr-only" : "eyebrow mb-2"}>
        {t("checkin.restingHr")} <span className="normal-case tracking-normal text-muted/70">· {t("checkin.restingHrOptional")}</span>
      </legend>

      {phase === "idle" && (
        <>
          {!compact && <p className="text-sm text-muted">{t("checkin.restingHrHint")}</p>}
          <button type="button" onClick={start} className={compact ? "btn-primary" : "btn-secondary"}>
            {t("checkin.restingHrStart")}
          </button>
        </>
      )}

      {phase === "running" && (
        <div className="card flex flex-col items-center gap-1 py-6" aria-live="polite">
          <span className="font-display text-6xl font-bold tabular-nums text-primary">{left}</span>
          <span className="eyebrow">{t("checkin.restingHrRunning")}</span>
        </div>
      )}

      {phase === "count" && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={4}
              max={40}
              value={count}
              onChange={(e) => updateCount(e.target.value)}
              className="input w-24 text-center font-display text-2xl font-semibold"
              aria-label={t("checkin.restingHrCountLabel")}
              autoFocus
            />
            <span className="text-sm text-muted">{t("checkin.restingHrCountLabel")}</span>
          </label>
          {value != null && (
            <p className="font-display text-lg font-semibold">{t("checkin.restingHrResult", { bpm: value })}</p>
          )}
          <button type="button" onClick={reset} className="self-start text-sm text-muted underline underline-offset-4">
            {t("checkin.restingHrReset")}
          </button>
        </div>
      )}
    </fieldset>
  );
}
