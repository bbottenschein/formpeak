"use client";

import { useEffect, useRef, useState } from "react";
import { fetchLastPerformance } from "@/features/gym/actions";
import { useT } from "@/lib/i18n/client";
import { inferMeasure } from "./prescription";
import type { FlowExercise } from "./training-flow";

export interface LibraryItem {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
}

const NONE = "00000000-0000-0000-0000-000000000000";

/**
 * Übung tauschen (Gerät belegt): ähnliche Übungen derselben Muskelgruppe zuerst, Suche in der
 * Bibliothek oder eigener Name. Vorgabe (Sätze × Wdh) bleibt, Gewicht kommt vom letzten Mal.
 */
export function ExerciseSwap({
  current,
  library,
  onPick,
  onClose,
}: {
  current: FlowExercise;
  library: LibraryItem[];
  onPick: (ex: FlowExercise) => void;
  onClose: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => ref.current?.showModal(), []);

  const group = library.find((l) => l.id === current.exerciseId)?.muscleGroup ?? null;
  const q = query.trim().toLowerCase();
  const list = q
    ? library.filter((l) => l.name.toLowerCase().includes(q))
    : library.filter((l) => l.id !== current.exerciseId && (group ? l.muscleGroup === group : true));

  const pick = async (l: LibraryItem | null) => {
    const base: FlowExercise = {
      name: l?.name ?? query.trim(),
      prescription: current.prescription,
      how: "",
      exerciseId: l?.id ?? null,
      measure: l ? inferMeasure(current.prescription, l.equipment) : current.measure === "weight_reps" ? "reps" : current.measure,
      last: null,
      best: null,
    };
    const last = l ? await fetchLastPerformance(l.id, NONE).catch(() => null) : null;
    onPick({ ...base, last: last?.sets ?? null });
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none border-t border-line bg-surface p-0 text-foreground backdrop:bg-black/60"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5">
        <p className="font-display text-xl font-semibold">{t("training.swapTitle", { name: current.name })}</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("training.swapSearch")}
          className="input"
          aria-label={t("training.swapSearch")}
        />
        {!q && group && <p className="eyebrow text-xs">{t("training.swapSimilar", { group: t(`gym.muscleGroups.${group as "legs"}`) })}</p>}
        <ul className="flex max-h-[45dvh] flex-col divide-y divide-line overflow-y-auto border-y border-line">
          {list.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => pick(l)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                <span>{l.name}</span>
                <span className="text-xs text-muted">{t(`gym.muscleGroups.${l.muscleGroup as "legs"}`)}</span>
              </button>
            </li>
          ))}
          {q && (
            <li>
              <button type="button" onClick={() => pick(null)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                <span>„{query.trim()}“</span>
                <span className="text-xs text-muted">{t("training.swapOwn")}</span>
              </button>
            </li>
          )}
        </ul>
        <button type="button" className="btn-secondary" onClick={() => ref.current?.close()}>
          {t("common.back")}
        </button>
      </div>
    </dialog>
  );
}
