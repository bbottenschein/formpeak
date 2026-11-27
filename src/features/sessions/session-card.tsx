import Link from "next/link";
import type { PainSpotStatus, SessionHint } from "@/core/load";
import type { Translate } from "@/lib/i18n/translate";
import type { SessionRow } from "./data";

/** Text eines Planungshinweises. */
export function hintText(h: SessionHint, t: Translate): string {
  switch (h.code) {
    case "light_yellow_reduce":
      return t("week.hints.light_yellow_reduce", { percent: h.percent });
    case "pain_spare_region":
      return t("week.hints.pain_spare_region", { spots: spotsText(h.spots, t) });
    default:
      return t(`week.hints.${h.code}`);
  }
}

function spotsText(spots: PainSpotStatus[], t: Translate): string {
  return spots
    .map((s) => `${t(`bodymap.regions.${s.region}`)}${s.side === "center" ? "" : ` ${t(`bodymap.sides.${s.side}`)}`}`)
    .join(", ");
}

/** Einheit als Zeile mit Status, Eckdaten und Hinweisen; führt zur Detailseite. */
export function SessionCard({
  session,
  hints = [],
  feedbackDue = false,
  t,
}: {
  session: SessionRow;
  hints?: SessionHint[];
  feedbackDue?: boolean;
  t: Translate;
}) {
  const cancelled = session.status === "cancelled";
  const done = session.status === "done";
  const suggested = (session.planned_by === "ai" || session.planned_by === "rules") && session.title;
  const meta = [
    suggested ? t(`sessionTypes.${session.type}`) : null,
    session.start_time?.slice(0, 5),
    t("common.minutes", { value: session.duration_min }),
    done && session.rpe != null ? `RPE ${session.rpe}` : null,
    session.type === "gym" && session.gym_focus ? t(`gymFocus.${session.gym_focus}`) : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/sessions/${session.id}`}
      className={`card flex flex-col gap-1.5 py-3 transition hover:border-muted/50 ${cancelled ? "opacity-50" : ""} ${
        session.is_fixture ? "border-l-4 border-l-foreground/70" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`font-display text-lg font-semibold uppercase tracking-wide ${cancelled ? "line-through" : ""}`}>
          {suggested ? session.title : t(`sessionTypes.${session.type}`)}
        </span>
        <span className="text-xs text-muted">
          {feedbackDue ? (
            <span className="font-semibold text-primary">{t("week.feedbackDue")}</span>
          ) : (
            t(`sessionStatus.${session.status}`)
          )}
        </span>
      </div>
      <span className="text-sm text-muted">{meta.join(" · ")}</span>
      {hints.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1 border-t border-line pt-2 text-sm text-light-yellow">
          {hints.map((h) => (
            <li key={h.code}>{hintText(h, t)}</li>
          ))}
        </ul>
      )}
    </Link>
  );
}
