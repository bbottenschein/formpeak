import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { GymProgress, WellbeingCharts } from "@/features/history/charts";
import { e1rmSeries, painHistory, weeklyVolume } from "@/features/history/logic";
import { getHistory } from "@/features/history/queries";
import { MUSCLE_GROUPS } from "@/features/gym/schema";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Verlauf" };

const DAYS = 28;
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export default async function HistoryPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const h = await getHistory(user.id, today, DAYS);

  const pain = painHistory(h.pains, h.from, today);
  const exerciseIds = Object.keys(h.exerciseNames);
  const series = Object.fromEntries(exerciseIds.map((id) => [id, e1rmSeries(h.sets, id)]).filter(([, s]) => s.length > 0));
  const volume = weeklyVolume(h.sets, today, 4);
  const groups = MUSCLE_GROUPS.filter((g) => volume.some((w) => (w.byGroup[g] ?? 0) > 0));

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold">{t("history.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("history.intro")}</p>
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{t("history.wellbeing")}</h2>
        <WellbeingCharts data={h.wellbeing} />
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{t("history.pain")}</h2>
        {pain.length === 0 && <p className="text-sm text-muted">{t("history.painEmpty")}</p>}
        {pain.map((row) => (
          <div key={`${row.region}|${row.side}`} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">
                {t(`bodymap.regions.${row.region}`)}
                {row.side !== "center" && ` ${t(`bodymap.sides.${row.side}`)}`}
              </span>
              <span className="text-xs text-muted">{t("history.painSummary", { days: row.daysWithPain, max: row.maxIntensity })}</span>
            </div>
            {/* Ein Feld pro Tag; Deckkraft = Stärke (eine Farbe, hell → dunkel). Wert im Tooltip. */}
            <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${row.days.length}, minmax(0, 1fr))` }}>
              {row.days.map((d) => (
                <span
                  key={d.date}
                  title={`${shortDate(d.date)}: ${d.intensity || "–"}`}
                  className="h-4 rounded-[2px]"
                  style={{
                    background: d.intensity ? "var(--light-red)" : "var(--line)",
                    opacity: d.intensity ? 0.25 + (d.intensity / 10) * 0.75 : 1,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        {pain.length > 0 && (
          <div className="flex justify-between text-[0.7rem] text-muted">
            <span>{shortDate(h.from)}</span>
            <span>{shortDate(today)}</span>
          </div>
        )}
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{t("history.gym")}</h2>
        {Object.keys(series).length === 0 ? (
          <p className="text-sm text-muted">{t("history.gymEmpty")}</p>
        ) : (
          <>
            <GymProgress series={series} names={h.exerciseNames} />
            <p className="eyebrow mt-2">{t("history.volume")}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-xs text-muted">
                    <th className="py-1 text-left font-normal" />
                    {volume.map((w) => (
                      <th key={w.week} className="py-1 text-right font-normal">
                        {shortDate(w.week)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g} className="border-t border-line">
                      <td className="py-1.5">{t(`gym.muscleGroups.${g}`)}</td>
                      {volume.map((w) => (
                        <td key={w.week} className="py-1.5 text-right">
                          {w.byGroup[g] ? Math.round(w.byGroup[g]).toLocaleString("de-DE") : t("history.empty")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
