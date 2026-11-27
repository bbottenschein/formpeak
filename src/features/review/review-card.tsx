import Link from "next/link";
import { Info } from "@/features/ui/info";
import type { Translate } from "@/lib/i18n/translate";
import type { ReviewData } from "./queries";
import { ReviewText } from "./review-text";

const monthName = (from: string) =>
  new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "UTC" }).format(new Date(`${from}T00:00:00Z`));

/** Rückblick als Karte: drei Zahlen, ein Satz, Link zu Details. */
export function ReviewCard({ data, text, t }: { data: ReviewData; text: string | null; t: Translate }) {
  const s = data.stats;
  const title = data.kind === "week" ? t("review.weekTitle") : t("review.monthTitle", { month: monthName(data.from) });
  const delta = s.loadDelta == null ? "–" : `${s.loadDelta > 0 ? "+" : s.loadDelta < 0 ? "−" : "±"}${Math.abs(s.loadDelta)} %`;
  const tiles = [
    { label: t("review.done"), value: `${s.done}/${s.planned}` },
    { label: t("review.load"), value: delta },
    { label: t("review.bests"), value: String(data.bests.length) },
  ];
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">{title}</h2>
        <Info title={title}>
          <p>{t("review.info")}</p>
        </Info>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((x) => (
          <div key={x.label} className="flex flex-col">
            <span className="font-display text-2xl font-bold tabular-nums">{x.value}</span>
            <span className="text-xs text-muted">{x.label}</span>
          </div>
        ))}
      </div>
      <ReviewText kind={data.kind} from={data.from} initial={text} />
      <Link href={`/review?kind=${data.kind}&from=${data.from}`} className="self-start text-sm text-muted underline underline-offset-4">
        {t("review.details")} →
      </Link>
    </div>
  );
}
