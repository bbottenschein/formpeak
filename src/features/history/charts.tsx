"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useT } from "@/lib/i18n/client";

const INK = "var(--foreground)";
const MUTED = "var(--muted)";
const LINE = "var(--line)";

const dayLabel = (date: string) => `${Number(date.slice(8))}.${Number(date.slice(5, 7))}.`;
const longDate = (date: string) =>
  new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
const num = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

const axis = { stroke: MUTED, tick: { fill: MUTED, fontSize: 11 }, tickLine: false, axisLine: false } as const;

export interface Point {
  date: string;
  value: number | null;
}

/** Eine Kennzahl über die Zeit (eine Linie, eine Achse), Lücken an Tagen ohne Wert. */
export function MetricChart({
  data,
  domain,
  ticks,
  format,
  height = 140,
}: {
  data: Point[];
  domain: [number, number] | ["auto", "auto"];
  ticks?: number[];
  format: (v: number) => string;
  height?: number;
}) {
  const t = useT();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid stroke={LINE} vertical={false} />
        <XAxis dataKey="date" tickFormatter={dayLabel} interval="preserveStartEnd" minTickGap={24} {...axis} />
        <YAxis domain={domain} ticks={ticks} allowDecimals={false} {...axis} />
        <Tooltip
          cursor={{ stroke: MUTED, strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload?.length && label ? (
              <div className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm">
                <p className="text-xs text-muted">{longDate(String(label))}</p>
                <p className="font-display text-base font-semibold">
                  {payload[0].value == null ? t("history.noValue") : format(Number(payload[0].value))}
                </p>
              </div>
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={INK}
          strokeWidth={2}
          connectNulls={false}
          dot={{ r: 3, fill: INK, stroke: "var(--surface)", strokeWidth: 2 }}
          activeDot={{ r: 5, fill: INK, stroke: "var(--surface)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Übung wählen und den 1RM-Verlauf zeigen. */
export function GymProgress({
  series,
  names,
}: {
  series: Record<string, { date: string; e1rm: number }[]>;
  names: Record<string, string>;
}) {
  const t = useT();
  const ids = Object.keys(series).sort((a, b) => names[a].localeCompare(names[b]));
  const [id, setId] = useState(ids[0]);
  const data = (series[id] ?? []).map((p) => ({ date: p.date, value: p.e1rm }));
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="label">{t("history.exercise")}</span>
        <select value={id} onChange={(e) => setId(e.target.value)} className="input">
          {ids.map((x) => (
            <option key={x} value={x}>
              {names[x]}
            </option>
          ))}
        </select>
      </label>
      <p className="eyebrow">{t("history.e1rm")}</p>
      {data.length >= 2 ? (
        <MetricChart data={data} domain={["auto", "auto"]} format={(v) => t("history.e1rmValue", { value: num(v) })} height={160} />
      ) : (
        <p className="text-sm text-muted">
          {data[0] ? `${t("history.e1rmValue", { value: num(data[0].value) })} · ` : ""}
          {t("history.e1rmSingle")}
        </p>
      )}
    </div>
  );
}

/** Wohlbefinden: vier kleine Diagramme, je eine Kennzahl. */
export function WellbeingCharts({
  data,
}: {
  data: { date: string; sleepHours: number | null; energy: number | null; stress: number | null; soreness: number | null }[];
}) {
  const t = useT();
  const pick = (k: "sleepHours" | "energy" | "stress" | "soreness") => data.map((d) => ({ date: d.date, value: d[k] }));
  const scale = (v: number) => String(v);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow">{t("history.sleep")}</p>
        <MetricChart data={pick("sleepHours")} domain={[0, 12]} ticks={[0, 4, 8, 12]} format={(v) => t("history.hours", { value: num(v) })} />
      </div>
      <div>
        <p className="eyebrow">{t("history.energy")}</p>
        <MetricChart data={pick("energy")} domain={[1, 5]} ticks={[1, 3, 5]} format={scale} height={110} />
      </div>
      <div>
        <p className="eyebrow">{t("history.soreness")}</p>
        <MetricChart data={pick("soreness")} domain={[1, 5]} ticks={[1, 3, 5]} format={scale} height={110} />
      </div>
      <div>
        <p className="eyebrow">{t("history.stress")}</p>
        <MetricChart data={pick("stress")} domain={[1, 5]} ticks={[1, 3, 5]} format={scale} height={110} />
      </div>
    </div>
  );
}
