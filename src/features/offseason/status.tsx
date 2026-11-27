import Link from "next/link";
import { offseasonWeek } from "@/core/load";
import { Info } from "@/features/ui/info";
import type { Translate } from "@/lib/i18n/translate";
import type { Offseason } from "./queries";

/** Eine Zeile: Abschnitt · Woche · Wochen bis zur Vorbereitung. Erklärung im Info-Symbol. */
export function OffseasonStatus({ off, date, t, editable = false }: { off: Offseason; date: string; t: Translate; editable?: boolean }) {
  const w = offseasonWeek(off.phase, date);
  const title = w.deload ? t("offseason.deload") : t(`offseason.blocks.${w.block}`);
  const meta = [
    w.totalWeeks ? t("offseason.statusOf", { week: w.week, total: w.totalWeeks }) : t("offseason.status", { week: w.week }),
    w.weeksToPreseason != null ? t("offseason.toPreseason", { weeks: w.weeksToPreseason }) : t("offseason.openEnd"),
  ];
  return (
    <div className="flex items-start justify-between gap-2 border-l-2 border-primary pl-3">
      <div className="flex flex-col">
        <span className="font-display text-xl font-semibold uppercase tracking-wide">{title}</span>
        <span className="text-sm text-muted">{meta.join(" · ")}</span>
        {editable && (
          <Link href="/offseason" className="mt-1 self-start text-sm text-muted underline underline-offset-4">
            {t("offseason.edit")}
          </Link>
        )}
      </div>
      <Info title={title}>
        <p>{t(`offseason.blockInfo.${w.deload ? "deload" : w.block}`)}</p>
      </Info>
    </div>
  );
}
