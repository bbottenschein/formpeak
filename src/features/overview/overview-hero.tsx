import Link from "next/link";
import type { DailyMetrics, LightReason, TrafficLight } from "@/core/load";
import type { Translate } from "@/lib/i18n/translate";
import { ReadinessRing } from "./readiness-ring";

const BADGE: Record<TrafficLight, string> = {
  green: "border-light-green/45 bg-light-green/18 text-light-green",
  yellow: "border-light-yellow/45 bg-light-yellow/18 text-light-yellow",
  red: "border-light-red/45 bg-light-red/18 text-light-red",
  grey: "border-light-grey/45 bg-light-grey/18 text-muted",
};
const DOT: Record<TrafficLight, string> = {
  green: "bg-light-green",
  yellow: "bg-light-yellow",
  red: "bg-light-red",
  grey: "bg-light-grey",
};

const num = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

function reasonText(r: LightReason, t: Translate): string {
  switch (r.code) {
    case "readiness_low":
    case "readiness_medium":
      return t(`today.reasons.${r.code}`, { value: r.readiness });
    case "acwr_spike":
    case "acwr_elevated":
      return t(`today.reasons.${r.code}`, { value: num(r.acwr) });
    default:
      return t(`today.reasons.${r.code}`);
  }
}

/** Kopf der Übersicht: Readiness-Ring, Ampel mit Empfehlung, ACWR, Check-in. */
export function OverviewHero({ metrics, t }: { metrics: DailyMetrics; t: Translate }) {
  const { light, readiness, acwr, calibrationDaysLeft } = metrics;
  const hasCheckin = readiness != null;
  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <ReadinessRing value={readiness} light={light} label={t("overview.readiness")} emptyLabel={t("overview.noCheckinRing")} />
        <div className="flex min-w-0 flex-col gap-2">
          <span
            className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-display text-sm font-semibold uppercase tracking-wider ${BADGE[light]}`}
          >
            <span className={`size-2 rounded-full ${DOT[light]}`} />
            {t(`today.lights.${light}`)}
          </span>
          <p className="font-medium leading-snug">{t(`today.lightAdvice.${light}`)}</p>
          <p className="text-xs text-muted">
            {acwr != null ? t("overview.acwr", { value: num(acwr) }) : t("overview.calibrating", { days: calibrationDaysLeft })}
          </p>
        </div>
      </div>

      {hasCheckin && light !== "green" && (
        <ul className="flex flex-col gap-1 border-t border-line pt-3 text-sm text-muted">
          {metrics.reasons.map((r) => (
            <li key={r.code}>{reasonText(r, t)}</li>
          ))}
        </ul>
      )}
      {metrics.underload && <p className="text-sm text-muted">{t("today.underload")}</p>}

      {hasCheckin ? (
        <Link href="/checkin" className="text-center text-sm text-muted underline underline-offset-4">
          {t("today.checkinEdit")}
        </Link>
      ) : (
        <Link href="/checkin" className="btn-primary text-center">
          {t("overview.checkinCta")}
        </Link>
      )}
    </div>
  );
}
