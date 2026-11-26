"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/core/load";
import { useT } from "@/lib/i18n/client";

// Farben nur über CSS-Variablen (Tokens aus globals.css).
const INK = "var(--foreground)";
const MUTED = "var(--muted)";
const LINE = "var(--line)";
const SURFACE = "var(--surface-raised)";

const dayLabel = (date: string) => `${Number(date.slice(8))}.`;
const longDate = (date: string) =>
  new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );

function ChartTooltip({ active, payload, label, render }: {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  label?: string;
  render: (p: TrendPoint) => string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-line px-3 py-2 text-sm shadow-none" style={{ background: SURFACE }}>
      <p className="text-xs text-muted">{longDate(label)}</p>
      <p className="font-display text-base font-semibold">{render(payload[0].payload)}</p>
    </div>
  );
}

const axisProps = {
  stroke: MUTED,
  tick: { fill: MUTED, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/** Readiness der letzten 14 Tage als Linie mit den Ampel-Schwellen 50 und 70. */
export function ReadinessTrend({ data }: { data: TrendPoint[] }) {
  const t = useT();
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid stroke={LINE} vertical={false} />
        <XAxis dataKey="date" tickFormatter={dayLabel} interval="preserveStartEnd" minTickGap={16} {...axisProps} />
        <YAxis domain={[0, 100]} ticks={[0, 50, 70, 100]} {...axisProps} />
        <ReferenceLine y={70} stroke={MUTED} strokeDasharray="4 4" />
        <ReferenceLine y={50} stroke={MUTED} strokeDasharray="4 4" />
        <Tooltip
          cursor={{ stroke: MUTED, strokeWidth: 1 }}
          content={<ChartTooltip render={(p) => (p.readiness == null ? t("overview.tooltipNoCheckin") : t("overview.tooltipReadiness", { value: p.readiness }))} />}
        />
        <Line
          type="monotone"
          dataKey="readiness"
          stroke={INK}
          strokeWidth={2}
          connectNulls={false}
          dot={{ r: 4, fill: INK, stroke: "var(--surface)", strokeWidth: 2 }}
          activeDot={{ r: 5, fill: INK, stroke: "var(--surface)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Tägliche Last (AU) der letzten 14 Tage als Balken. */
export function LoadTrend({ data }: { data: TrendPoint[] }) {
  const t = useT();
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap={2}>
        <CartesianGrid stroke={LINE} vertical={false} />
        <XAxis dataKey="date" tickFormatter={dayLabel} interval="preserveStartEnd" minTickGap={16} {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip
          cursor={{ fill: LINE }}
          content={<ChartTooltip render={(p) => t("overview.tooltipLoad", { value: Math.round(p.load) })} />}
        />
        <Bar dataKey="load" fill={MUTED} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
