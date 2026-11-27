import { Info } from "@/features/ui/info";
import type { Translate } from "@/lib/i18n/translate";

function Tile({ label, info, delta, empty, t }: { label: string; info: string; delta: number | null; empty: string; t: Translate }) {
  const text =
    delta == null
      ? empty
      : delta === 0
        ? t("home.atNormal")
        : t("home.vsNormal", { dir: delta > 0 ? t("home.above") : t("home.below") });
  return (
    <div className="card flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-xs">{label}</span>
        <Info title={label} className="-my-1">
          <p>{info}</p>
        </Info>
      </div>
      {delta != null ? (
        <span className="font-display text-3xl font-bold tabular-nums leading-none">
          {delta > 0 ? "+" : delta < 0 ? "−" : "±"}
          {Math.abs(delta)} %
        </span>
      ) : (
        <span className="font-display text-3xl font-bold leading-none text-muted">–</span>
      )}
      <span className="text-xs text-muted">{text}</span>
    </div>
  );
}

/** Akutes Belastungs- und Stresslevel im Vergleich zum persönlichen Normalwert (SPEC 4.3b). */
export function DeltaTiles({ loadDelta, stressDelta, t }: { loadDelta: number | null; stressDelta: number | null; t: Translate }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile label={t("home.load")} info={t("home.loadInfo")} delta={loadDelta} empty={t("home.noNormal")} t={t} />
      <Tile label={t("home.stress")} info={t("home.stressInfo")} delta={stressDelta} empty={t("home.noNormalStress")} t={t} />
    </div>
  );
}
