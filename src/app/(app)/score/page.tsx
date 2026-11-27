import type { Metadata } from "next";
import Link from "next/link";
import { biggestDrag, type ScoreComponent } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { ReadinessRing } from "@/features/overview/readiness-ring";
import { computeMetricsFor } from "@/features/today/metrics";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";

export const metadata: Metadata = { title: "Score" };

const num = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

const BASIS: Record<ScoreComponent["key"], MessageKey> = {
  sleepDuration: "score.basisWellness",
  sleepQuality: "score.basisWellness",
  energy: "score.basisWellness",
  soreness: "score.basisWellness",
  stress: "score.basisWellness",
  restingHr: "score.basisHr",
  load: "score.basisLoad",
};

/** Aufschlüsselung des Performance-Scores (docs/AENDERUNGEN.md › Transparenz). */
export default async function ScorePage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const metrics = await computeMetricsFor(user.id, today, today);
  const perf = metrics.performance;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold">{t("score.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("score.intro")}</p>
      </div>

      {!perf ? (
        <div className="card flex flex-col gap-3">
          <p className="text-muted">{t("home.noCheckin")}</p>
          <Link href="/checkin" className="btn-primary text-center">
            {t("home.checkinCta")}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <ReadinessRing value={perf.score} light={metrics.light} label={t("home.scoreLabel")} emptyLabel="" />
            <div className="flex flex-col gap-1 text-sm">
              <p>
                {t("score.recovery")}: <span className="font-display text-lg font-semibold">{perf.recovery}</span>
              </p>
              <p>
                {t("score.correction")}: <span className="font-display text-lg font-semibold">{perf.correction > 0 ? `−${perf.correction}` : "0"}</span>
              </p>
              <p>
                {t("score.final")}: <span className="font-display text-lg font-semibold">{perf.score}</span>
              </p>
            </div>
          </div>

          {(() => {
            const drag = biggestDrag(perf);
            return drag ? (
              <p className="font-medium">
                {t("score.drag", { component: t(`score.components.${drag.key}`), value: num(drag.lost) })}
              </p>
            ) : null;
          })()}

          <ul className="flex flex-col gap-2">
            {perf.components.map((c) => (
              <li key={c.key} className="card flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-lg font-semibold uppercase tracking-wide">{t(`score.components.${c.key}`)}</span>
                  {c.key !== "load" && c.value != null && (
                    <span className="text-xs text-muted">{t("score.share", { value: num(c.weight) })}</span>
                  )}
                </div>
                {c.key === "load" ? (
                  <p className="text-sm">
                    {metrics.acwr == null
                      ? t("score.correctionCalibrating")
                      : perf.correction > 0
                        ? t("score.correctionApplied", { acwr: num(metrics.acwr), value: perf.correction })
                        : t("score.correctionNone")}
                  </p>
                ) : c.value == null ? (
                  <p className="text-sm text-muted">{t("score.notToday")}</p>
                ) : (
                  <>
                    {/* Balken: gefüllter Anteil = Teilwert, eine Farbe (Text trägt die Zahl). */}
                    <div className="h-1.5 w-full rounded-full bg-line" aria-hidden>
                      <div className="h-1.5 rounded-full bg-foreground/80" style={{ width: `${c.value}%` }} />
                    </div>
                    <p className="text-sm">{c.lost < 0.5 ? t("score.full") : t("score.costs", { value: num(c.lost) })}</p>
                  </>
                )}
                <p className="text-xs text-muted">
                  {t("score.basis")}: {t(BASIS[c.key])}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="eyebrow">{t("score.weightsTitle")}</h2>
        <p className="text-sm text-muted">{t("score.weightsText")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="eyebrow">{t("score.limitsTitle")}</h2>
        <p className="text-sm text-muted">{t("score.limitsText")}</p>
      </div>
      <Link href="/sources" className="btn-secondary text-center">
        {t("score.sourcesLink")}
      </Link>
    </section>
  );
}
