"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { formatClock } from "./prescription";

/** Countdown für Zeitvorgaben; vibriert am Ende, wenn das Gerät es kann. */
export function Timer({ seconds }: { seconds: number }) {
  const t = useT();
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          setRunning(false);
          navigator.vibrate?.([200, 100, 200]);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
      <span className={`font-display text-4xl font-bold tabular-nums ${left === 0 ? "text-primary" : ""}`}>
        {left === 0 ? t("training.timeUp") : formatClock(left)}
      </span>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          if (left === 0) setLeft(seconds);
          setRunning((r) => !r || left === 0);
        }}
      >
        {running ? t("training.pause") : left === 0 ? t("training.again") : left === seconds ? t("training.timerStart") : t("training.resume")}
      </button>
    </div>
  );
}
