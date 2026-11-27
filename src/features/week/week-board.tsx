"use client";

import { useState, type ReactNode } from "react";

export interface BoardBar {
  /** fixture = Fußball, plan = Vorschlag/eigene Einheit, test = Referenz-/Abschlusstest */
  kind: "fixture" | "plan" | "test";
  minutes: number;
  done: boolean;
}

export interface BoardDay {
  date: string;
  weekday: string;
  dayNum: string;
  md: string | null;
  isToday: boolean;
  bars: BoardBar[];
}

/** Balkenhöhe nach Dauer (90 min ≈ volle Höhe eines Blocks). */
const barHeight = (min: number) => Math.max(6, Math.min(40, Math.round((min / 90) * 40)));

/**
 * Wochenleiste: 7 Spalten, je Einheit ein Balken (Höhe = Dauer; Fußball gefüllt, eigene Einheiten
 * umrandet, Tests gestrichelt, erledigt abgeblendet). Antippen zeigt darunter nur diesen Tag.
 */
export function WeekBoard({ days, details, initial }: { days: BoardDay[]; details: ReactNode[]; initial: number }) {
  const [selected, setSelected] = useState(initial);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-1" role="tablist">
        {days.map((d, i) => {
          const active = i === selected;
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(i)}
              className={`flex min-h-36 flex-col items-center gap-1 rounded-lg border px-0.5 pb-2 pt-1.5 transition ${
                active ? "border-primary" : "border-line hover:border-muted/50"
              }`}
            >
              <span className="font-display text-xs font-semibold uppercase tracking-wide text-muted">{d.weekday}</span>
              <span className={`font-display text-lg font-bold leading-none ${d.isToday ? "text-primary" : ""}`}>{d.dayNum}</span>
              <span className="h-3 font-display text-[10px] font-semibold leading-3 text-muted">{d.md ?? ""}</span>
              <span className="flex w-full flex-1 flex-col items-center gap-1 px-1 pt-1">
                {d.bars.map((b, j) => (
                  <span
                    key={j}
                    aria-hidden
                    style={{ height: barHeight(b.minutes) }}
                    className={`w-full rounded-sm ${
                      b.kind === "fixture"
                        ? "bg-foreground/80"
                        : b.kind === "test"
                          ? "border border-dashed border-foreground/80"
                          : "border border-foreground/60"
                    } ${b.done ? "opacity-40" : ""}`}
                  />
                ))}
                {d.bars.length === 0 && <span aria-hidden className="mt-1 size-1 rounded-full bg-line" />}
              </span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{details[selected]}</div>
    </div>
  );
}
