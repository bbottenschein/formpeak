import type { PainSpotStatus } from "@/core/load";
import type { Translate } from "@/lib/i18n/translate";

const LEVEL_TEXT = {
  note: "today.painNote",
  restrict: "today.painRestrict",
  red: "today.painRed",
} as const;

const LEVEL_BORDER = {
  note: "border-line",
  restrict: "border-light-yellow/45",
  red: "border-light-red/45",
} as const;

/** Aktive Schmerzstellen mit den Folgen aus den Schmerzregeln. */
export function PainList({ spots, t }: { spots: PainSpotStatus[]; t: Translate }) {
  if (spots.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="eyebrow">{t("today.painTitle")}</h2>
      <ul className="flex flex-col gap-2">
        {spots.map((s) => (
          <li key={`${s.region}|${s.side}`} className={`card ${LEVEL_BORDER[s.level]}`}>
            <p className="font-medium">
              {t(`bodymap.regions.${s.region}`)}
              {s.side !== "center" && ` ${t(`bodymap.sides.${s.side}`)}`}
              <span className="text-muted">
                {" · "}
                {t("bodymap.intensityValue", { value: s.intensity })}
                {s.seriesDays > 1 && ` · ${t("today.painSeries", { days: s.seriesDays })}`}
              </span>
            </p>
            <p className={`mt-1 text-sm ${s.level === "red" ? "text-light-red" : "text-muted"}`}>
              {t(LEVEL_TEXT[s.level])}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
