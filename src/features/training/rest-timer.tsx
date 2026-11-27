"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { formatClock } from "./prescription";

/** Pause nach einem Satz: läuft bis `until`, vibriert am Ende, lässt sich überspringen. */
export function RestTimer({ until, onDone }: { until: number; onDone: () => void }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.round((until - now) / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) {
        clearInterval(id);
        navigator.vibrate?.([200, 100, 200]);
      }
    }, 250);
    return () => clearInterval(id);
  }, [until]);

  return (
    <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised p-3" role="timer" aria-live="polite">
      <span className="flex items-baseline gap-2">
        <span className="eyebrow">{left > 0 ? t("training.rest") : t("training.restOver")}</span>
        <span className={`font-display text-3xl font-bold tabular-nums ${left === 0 ? "text-primary" : ""}`}>{formatClock(left)}</span>
      </span>
      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={onDone}>
        {left > 0 ? t("training.skipRest") : t("training.restClose")}
      </button>
    </div>
  );
}
