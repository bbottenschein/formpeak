"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { formatClock } from "./prescription";

/**
 * Pause nach einem Satz. Läuft über einen Zeitstempel – stimmt also auch nach Bildschirm aus oder
 * App-Wechsel. Vibriert am Ende (wenn die App offen ist), −30 s / +30 s, überspringen.
 */
export function RestTimer({ until, onChange, onDone }: { until: number; onChange: (until: number) => void; onDone: () => void }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.round((until - now) / 1000));

  useEffect(() => {
    let buzzed = false;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (n >= until && !buzzed) {
        buzzed = true;
        navigator.vibrate?.([200, 100, 200]);
      }
    };
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [until]);

  return (
    <div
      className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-raised p-3"
      role="timer"
      aria-live="polite"
    >
      <span className="flex flex-col">
        <span className="eyebrow">{left > 0 ? t("training.rest") : t("training.restOver")}</span>
        <span className={`font-display text-3xl font-bold tabular-nums ${left === 0 ? "text-primary" : ""}`}>{formatClock(left)}</span>
      </span>
      <span className="flex items-center gap-1.5">
        {left > 0 && (
          <>
            <button type="button" className="btn-secondary px-2.5 py-2 text-sm" onClick={() => onChange(until - 30_000)}>
              −30
            </button>
            <button type="button" className="btn-secondary px-2.5 py-2 text-sm" onClick={() => onChange(until + 30_000)}>
              +30
            </button>
          </>
        )}
        <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={onDone}>
          {left > 0 ? t("training.skipRest") : t("training.restClose")}
        </button>
      </span>
    </div>
  );
}
