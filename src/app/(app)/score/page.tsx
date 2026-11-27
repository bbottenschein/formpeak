import type { Metadata } from "next";
import Link from "next/link";
import { biggestDrag, type ScoreComponent } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { ReadinessRing } from "@/features/overview/readiness-ring";
import { computeMetricsFor } from "@/features/today/metrics";
import { Info } from "@/features/ui/info";
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
  const drag = perf ? biggestDrag(perf) : null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-4xl font-bold">{t("score.title")}</h1>
        <Info title={t("score.reliableTitle")}>
          <p className="text-foreground">{t("score.intro")}</p>
          <p className="eyebrow mt-2 text-xs">{t("score.weightsTitle")}</p>
          <p>{t("score.weightsText")}</p>
          <p className="eyebrow mt-2 text-xs">{t("score.limitsTitle")}</p>
          <p>{t("score.limitsText")}</p>
        </Info>
      </div>

      {!perf ? (
        <Link href="/checkin" className="btn-primary text-center">
          {t("home.checkinCta")}
        </Link>
      ) : (
        <>
          <div className="flex items-center gap-5">
            <ReadinessRing value={perf.score} light={metrics.light} label={t("home.scoreLabel")} emptyLabel="" />
            <dl className="grid flex-1 grid-cols-1 gap-2">
              <div className="flex items-baseline justify-between border-b border-line pb-1.5">
                <dt className="text-sm text-muted">{t("score.recoveryShort")}</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums">{perf.recovery}</dd>
              </div>
              <div className="flex items-baseline justify-between border-b border-line pb-1.5">
                <dt className="text-sm text-muted">{t("score.correctionShort")}</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums">{perf.correction > 0 ? `−${perf.correction}` : "0"}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-sm text-muted">{t("score.finalShort")}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{perf.score}</dd>
              </div>
            </dl>
          </div>

          {drag && (
            <p className="border-l-2 border-line pl-3 font-medium">
              {t("score.drag", { component: t(`score.components.${drag.key}`), value: num(drag.lost) })}
            </p>
          )}

          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {perf.components.map((c) => {
              const name = t(`score.components.${c.key}`);
              const value =
                c.key === "load"
                  ? metrics.acwr == null
                    ? "–"
                    : perf.correction > 0
                      ? `−${perf.correction}`
                      : "0"
                  : c.value == null
                    ? "–"
                    : c.lost < 0.5
                      ? "0"
                      : `−${num(c.lost)}`;
              return (
                <li key={c.key} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span className="font-display text-lg font-semibold uppercase tracking-wide">{name}</span>
                      <Info title={name} className="-my-1">
                        {c.key === "load" ? (
                          <p className="text-foreground">
                            {metrics.acwr == null
                              ? t("score.correctionCalibrating")
                              : perf.correction > 0
                                ? t("score.correctionApplied", { acwr: num(metrics.acwr), value: perf.correction })
                                : t("score.correctionNone")}
                          </p>
                        ) : (
                          <p className="text-foreground">
                            {c.value == null ? t("score.notToday") : t("score.share", { value: num(c.weight) })}
                          </p>
                        )}
                        <p>
                          {t("score.basis")}: {t(BASIS[c.key])}
                        </p>
                      </Info>
                    </span>
                    <span className={`font-display text-lg font-semibold tabular-nums ${value === "0" || value === "–" ? "text-muted" : ""}`}>
                      {value}
                    </span>
                  </div>
                  {c.key !== "load" && c.value != null && (
                    <div className="h-1.5 w-full rounded-full bg-line" aria-hidden>
                      <div className="h-1.5 rounded-full bg-foreground/80" style={{ width: `${c.value}%` }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Link href="/sources" className="self-start text-sm text-muted underline underline-offset-4">
        {t("score.sourcesLink")} →
      </Link>
    </section>
  );
}
