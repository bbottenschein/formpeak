import Link from "next/link";
import { addDays, offseasonWeek, returnWeeks } from "@/core/load";
import type { Offseason } from "@/features/offseason/queries";
import type { Translate } from "@/lib/i18n/translate";
import type { GoalData } from "./queries";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const longDate = (d: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/**
 * Trainingsrahmen des aktuellen Modus: Saison (aus dem Ziel) oder Off-Season (eigener Rahmen mit
 * Abschnitten bis zur Vorbereitung). Ein Ziel, zwei Rahmen – je nach Modus.
 */
export function FrameCard({
  frame,
  off,
  today,
  t,
}: {
  frame: GoalData["frame"];
  off: Offseason | null;
  today: string;
  t: Translate;
}) {
  const f = off?.frame ?? frame;
  const days = f
    ? [...f.availableWeekdays]
        .sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b))
        .map((d) => t(`weekdays.short.${d as 0}`))
        .join(", ")
    : "";
  const week = off ? offseasonWeek(off.phase, today) : null;
  const ret = off ? returnWeeks(week!.totalWeeks, off.phase.recoveryWeeks) : 0;
  const blocks = off
    ? [
        { key: "recover" as const, weeks: off.phase.recoveryWeeks },
        { key: "build" as const, weeks: week!.totalWeeks == null ? null : Math.max(0, week!.totalWeeks - off.phase.recoveryWeeks - ret) },
        { key: "return" as const, weeks: ret },
      ].filter((b) => b.weeks == null || b.weeks > 0)
    : [];

  return (
    <div className="card flex flex-col gap-3">
      <h2 className="eyebrow">{off ? t("goalView.frameOff") : t("goalView.frameSeason")}</h2>
      {f && f.extraSessionsPerWeek > 0 ? (
        <div className="flex flex-col gap-0.5">
          <p className="font-display text-2xl font-semibold">
            {t("goalView.frameLine", { sessions: f.extraSessionsPerWeek, minutes: f.timeBudgetMin })}
          </p>
          <p className="text-sm text-muted">
            {[days, f.equipment.map((e) => t(`goal.equipmentTypes.${e}`)).join(", ")].filter(Boolean).join(" · ")}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">{t("goalView.frameNone")}</p>
      )}

      {off && (
        <>
          <ol className="flex flex-col divide-y divide-line border-y border-line">
            {blocks.map((b) => (
              <li key={b.key} className={`flex items-center justify-between gap-3 py-2 ${week!.block === b.key ? "" : "text-muted"}`}>
                <span className={week!.block === b.key ? "font-semibold" : ""}>
                  {t(`offseason.blocks.${b.key}`)}
                  {week!.block === b.key && ` · ${t("goalView.now").toLowerCase()}`}
                </span>
                <span className="text-sm tabular-nums">{b.weeks == null ? "…" : t("offseason.wizard.weeks", { count: b.weeks })}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">
            {off.phase.endsOn ? t("offseason.wizard.untilDate", { date: longDate(addDays(off.phase.endsOn, 1)) }) : t("offseason.openEnd")}
          </p>
        </>
      )}

      <Link href={off ? "/offseason" : "/goals/edit?part=frame"} className="self-start text-sm text-muted underline underline-offset-4">
        {t("goalView.editFrame")}
      </Link>
    </div>
  );
}
