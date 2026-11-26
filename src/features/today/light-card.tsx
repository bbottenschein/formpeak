import type { DailyMetrics, LightReason, TrafficLight } from "@/core/load";
import type { Translate } from "@/lib/i18n/translate";

const LIGHT_STYLES: Record<TrafficLight, string> = {
  green: "border-light-green/45 bg-light-green/18 text-light-green",
  yellow: "border-light-yellow/45 bg-light-yellow/18 text-light-yellow",
  red: "border-light-red/45 bg-light-red/18 text-light-red",
  grey: "border-light-grey/45 bg-light-grey/18 text-muted",
};

const DOT_STYLES: Record<TrafficLight, string> = {
  green: "bg-light-green",
  yellow: "bg-light-yellow",
  red: "bg-light-red",
  grey: "bg-light-grey",
};

const formatNumber = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

function reasonText(r: LightReason, t: Translate): string {
  switch (r.code) {
    case "readiness_low":
    case "readiness_medium":
      return t(`today.reasons.${r.code}`, { value: r.readiness });
    case "acwr_spike":
    case "acwr_elevated":
      return t(`today.reasons.${r.code}`, { value: formatNumber(r.acwr) });
    default:
      return t(`today.reasons.${r.code}`);
  }
}

/** Tagesampel mit Readiness, ACWR und Begründung. */
export function LightCard({ metrics, t }: { metrics: DailyMetrics; t: Translate }) {
  const { light, readiness, acwr, calibrationDaysLeft } = metrics;
  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-display text-sm font-semibold uppercase tracking-wider ${LIGHT_STYLES[light]}`}
        >
          <span className={`size-2 rounded-full ${DOT_STYLES[light]}`} />
          {t(`today.lights.${light}`)}
        </span>
        {readiness != null && (
          <span className="text-right">
            <span className="eyebrow block text-xs">{t("today.readiness")}</span>
            <span className="font-display text-4xl font-bold tabular-nums leading-none">{readiness}</span>
          </span>
        )}
      </div>

      <p className="font-medium">{t(`today.lightAdvice.${light}`)}</p>

      {light !== "grey" && (
        <ul className="flex flex-col gap-1 text-sm text-muted">
          {metrics.reasons.map((r) => (
            <li key={r.code}>{reasonText(r, t)}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
        <span className="text-muted">{t("today.acwr")}</span>
        {acwr != null ? (
          <span className="font-display text-lg font-semibold tabular-nums">{formatNumber(acwr)}</span>
        ) : (
          <span className="text-right text-muted">{t("today.calibrating", { days: calibrationDaysLeft })}</span>
        )}
      </div>
      {metrics.underload && <p className="text-sm text-muted">{t("today.underload")}</p>}
    </div>
  );
}
