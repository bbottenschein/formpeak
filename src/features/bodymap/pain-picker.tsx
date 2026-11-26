"use client";

import { useState } from "react";
import type { BodyRegion, BodySide, PainKind } from "@/core/load";
import type { PainInput } from "@/features/checkin/schema";
import { useT } from "@/lib/i18n/client";
import { PAIN_KINDS, REGION_GROUPS, defaultKindFor, sidesFor, swellingRelevant } from "./regions";

const chip = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-sm transition ${
    active ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface hover:border-muted/50"
  }`;

/**
 * Schmerzstellen erfassen: Region antippen → Seite, Stärke, Art. Bewusst als Liste von oben
 * nach unten statt Figur, damit man auf dem Handy sicher trifft.
 */
export function PainPicker({ value, onChange }: { value: PainInput[]; onChange: (p: PainInput[]) => void }) {
  const t = useT();
  const [draft, setDraft] = useState<PainInput | null>(null);

  const label = (p: Pick<PainInput, "region" | "side">) =>
    `${t(`bodymap.regions.${p.region}`)}${p.side === "center" ? "" : ` ${t(`bodymap.sides.${p.side}`)}`}`;

  function pickRegion(region: BodyRegion) {
    const side = sidesFor(region)[0];
    setDraft({ region, side, intensity: 3, kind: defaultKindFor(region), swollen: false });
  }

  function addDraft() {
    if (!draft) return;
    const rest = value.filter((p) => !(p.region === draft.region && p.side === draft.side));
    onChange([...rest, { ...draft, swollen: swellingRelevant(draft.kind) && draft.swollen }]);
    setDraft(null);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="eyebrow mb-2">{t("checkin.pain")}</legend>

      {value.length === 0 && !draft && <p className="text-sm text-muted">{t("checkin.painNone")}</p>}

      {value.length > 0 && (
        <ul className="flex flex-col gap-2">
          {value.map((p) => (
            <li key={`${p.region}|${p.side}`} className="card flex items-center justify-between gap-3 py-3">
              <span>
                <span className="font-medium">{label(p)}</span>
                <span className="block text-sm text-muted">
                  {t("bodymap.intensityValue", { value: p.intensity })} · {t(`bodymap.kinds.${p.kind}`)}
                  {p.swollen ? ` · ${t("bodymap.swollen")}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== p))}
                className="text-sm text-muted underline underline-offset-4"
              >
                {t("common.remove")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!draft && (
        <details className="group">
          <summary className="btn-secondary cursor-pointer list-none text-center">{t("checkin.painAdd")}</summary>
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-muted">{t("bodymap.chooseRegion")}</p>
            {REGION_GROUPS.map((g) => (
              <div key={g.key} className="flex flex-col gap-1.5">
                <span className="text-xs text-muted">{t(`bodymap.groups.${g.key}`)}</span>
                <div className="flex flex-wrap gap-1.5">
                  {g.regions.map((r) => (
                    <button key={r} type="button" onClick={() => pickRegion(r)} className={chip(false)}>
                      {t(`bodymap.regions.${r}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {draft && (
        <div className="card flex flex-col gap-4">
          <p className="font-display text-xl font-semibold">{t(`bodymap.regions.${draft.region}`)}</p>

          {sidesFor(draft.region).length > 1 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">{t("bodymap.side")}</span>
              <div className="grid grid-cols-2 gap-1.5">
                {sidesFor(draft.region).map((s: BodySide) => (
                  <button key={s} type="button" onClick={() => setDraft({ ...draft, side: s })} className={chip(draft.side === s)}>
                    {t(`bodymap.sides.${s}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">{t("bodymap.intensity")}</span>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDraft({ ...draft, intensity: n })}
                  className={`h-10 rounded-md border font-display text-base font-semibold ${
                    draft.intensity === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-line bg-surface"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">{t("bodymap.kind")}</span>
            <div className="grid grid-cols-4 gap-1.5">
              {PAIN_KINDS.map((k: PainKind) => (
                <button key={k} type="button" onClick={() => setDraft({ ...draft, kind: k })} className={chip(draft.kind === k)}>
                  {t(`bodymap.kinds.${k}`)}
                </button>
              ))}
            </div>
          </div>

          {swellingRelevant(draft.kind) && (
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.swollen}
                onChange={(e) => setDraft({ ...draft, swollen: e.target.checked })}
                className="size-5 accent-primary"
              />
              {t("bodymap.swollen")}
            </label>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDraft(null)} className="btn-secondary">
              {t("common.cancel")}
            </button>
            <button type="button" onClick={addDraft} className="btn-primary py-2.5 text-base">
              {t("bodymap.addEntry")}
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
