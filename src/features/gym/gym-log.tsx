"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import type { TrafficLight } from "@/core/load";
import { useT } from "@/lib/i18n/client";
import { createCustomExercise, fetchLastPerformance, saveGymLog, type GymLogState } from "./actions";
import { best1rm, setsFromSuggestion, suggestNext, type GymSet } from "./logic";
import type { Exercise, LastPerformance, LoggedExercise } from "./queries";
import { EQUIPMENT, MUSCLE_GROUPS } from "./schema";

type Entry = LoggedExercise & { last: LastPerformance | null };

const DEFAULT_SET: GymSet = { weightKg: 0, reps: 8, rir: null, setType: "working" };
const kg = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** Gym-Log einer Einheit: Übungen, Sätze mit Gewicht/Wdh/RIR, Vorbelegung und Vorschlag. */
export function GymLog({
  sessionId,
  library: initialLibrary,
  initial,
  last,
  light,
}: {
  sessionId: string;
  library: Exercise[];
  initial: LoggedExercise[];
  last: Record<string, LastPerformance>;
  light?: TrafficLight;
}) {
  const t = useT();
  const [library, setLibrary] = useState(initialLibrary);
  const [entries, setEntries] = useState<Entry[]>(initial.map((e) => ({ ...e, last: last[e.exerciseId] ?? null })));
  const [picking, setPicking] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [adding, startAdding] = useTransition();
  const [state, action, pending] = useActionState<GymLogState, FormData>(
    async (prev, fd) => {
      const result = await saveGymLog(sessionId, prev, fd);
      if (!result.error) setDirty(false);
      return result;
    },
    {},
  );
  const byId = useMemo(() => new Map(library.map((e) => [e.id, e])), [library]);

  const update = (next: Entry[]) => {
    setEntries(next);
    setDirty(true);
  };
  const setAt = (i: number, patch: Partial<Entry>) => update(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const updateSet = (i: number, si: number, patch: Partial<GymSet>) =>
    setAt(i, { sets: entries[i].sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) });

  function addExercise(exerciseId: string) {
    setPicking(false);
    startAdding(async () => {
      const perf = await fetchLastPerformance(exerciseId, sessionId);
      const sets = perf?.sets.length ? perf.sets.map((s) => ({ ...s, rir: null })) : [DEFAULT_SET];
      update([...entries, { exerciseId, note: null, sets, last: perf }]);
    });
  }

  const payload = JSON.stringify({
    exercises: entries.map(({ exerciseId, note, sets }) => ({ exerciseId, note, sets })),
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="payload" value={payload} />
      <div>
        <h2 className="text-2xl font-bold">{t("gym.title")}</h2>
        <p className="text-sm text-muted">{t("gym.intro")}</p>
      </div>

      {entries.length === 0 && <p className="text-sm text-muted">{t("gym.empty")}</p>}

      {entries.map((entry, i) => {
        const ex = byId.get(entry.exerciseId);
        const suggestion = entry.last ? suggestNext(entry.last.sets, light) : null;
        return (
          <div key={`${entry.exerciseId}-${i}`} className="card flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-xl font-semibold">{ex?.name ?? "–"}</p>
                {entry.last && (
                  <p className="text-xs text-muted">
                    {t("gym.last", {
                      date: shortDate(entry.last.date),
                      sets: entry.last.sets
                        .filter((s) => s.setType === "working")
                        .map((s) => (s.weightKg > 0 ? `${kg(s.weightKg)}×${s.reps}` : `${s.reps}`))
                        .join(", "),
                    })}
                    {best1rm(entry.last.sets) > 0 && ` · ${t("gym.e1rm", { value: kg(best1rm(entry.last.sets)) })}`}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => update(entries.filter((_, j) => j !== i))}
                className="shrink-0 text-xs text-muted underline underline-offset-4"
              >
                {t("gym.removeExercise")}
              </button>
            </div>

            {entry.last && light === "red" && <p className="text-xs text-light-red">{t("gym.noSuggestionRed")}</p>}
            {suggestion && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 px-3 py-2">
                <div className="text-sm">
                  <p className="font-medium text-primary">
                    {suggestion.weightKg > 0
                      ? t("gym.suggestion", { sets: suggestion.sets, reps: suggestion.reps, weight: kg(suggestion.weightKg) })
                      : t("gym.suggestionBodyweight", { sets: suggestion.sets, reps: suggestion.reps })}
                  </p>
                  <p className="text-xs text-muted">{t(`gym.suggestionReasons.${suggestion.reason}`)}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAt(i, { sets: [...entry.sets.filter((s) => s.setType === "warmup"), ...setsFromSuggestion(suggestion)] })
                  }
                  className="btn-secondary shrink-0 px-3 py-1.5 text-sm"
                >
                  {t("gym.applySuggestion")}
                </button>
              </div>
            )}

            <div className="grid grid-cols-[1.5rem_1fr_1fr_4rem_auto] items-center gap-x-2 gap-y-1.5 text-xs text-muted">
              <span>#</span>
              <span>{t("gym.weight")}</span>
              <span>{t("gym.reps")}</span>
              <span title={t("gym.rirHint")}>{t("gym.rir")}</span>
              <span />
              {entry.sets.map((s, si) => (
                <SetRow
                  key={si}
                  index={si}
                  set={s}
                  onChange={(patch) => updateSet(i, si, patch)}
                  onRemove={() => setAt(i, { sets: entry.sets.filter((_, j) => j !== si) })}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAt(i, { sets: [...entry.sets, { ...(entry.sets.at(-1) ?? DEFAULT_SET), rir: null }] })}
              className="btn-secondary py-2 text-sm"
            >
              {t("gym.addSet")}
            </button>
          </div>
        );
      })}

      {picking ? (
        <ExercisePicker
          library={library}
          onPick={addExercise}
          onCreated={(e) => {
            setLibrary([...library, e].sort((a, b) => a.name.localeCompare(b.name)));
            addExercise(e.id);
          }}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <button type="button" disabled={adding} onClick={() => setPicking(true)} className="btn-secondary">
          {t("gym.addExercise")}
        </button>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !dirty} className="btn-primary">
        {pending ? t("gym.saving") : dirty || !state.savedAt ? t("gym.save") : t("gym.saved")}
      </button>
    </form>
  );
}

function SetRow({
  index,
  set,
  onChange,
  onRemove,
}: {
  index: number;
  set: GymSet;
  onChange: (patch: Partial<GymSet>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const warm = set.setType === "warmup";
  return (
    <>
      <button
        type="button"
        onClick={() => onChange({ setType: warm ? "working" : "warmup" })}
        title={warm ? t("gym.warmup") : t("gym.working")}
        className={`font-display text-base font-semibold ${warm ? "text-muted" : "text-foreground"}`}
      >
        {warm ? "W" : index + 1}
      </button>
      <input
        type="number"
        inputMode="decimal"
        step={0.5}
        min={0}
        max={500}
        value={set.weightKg}
        onChange={(e) => onChange({ weightKg: Math.round(Number(e.target.value) * 2) / 2 })}
        aria-label={`${t("gym.set")} ${index + 1} ${t("gym.weight")}`}
        className="input px-2 py-2 text-center text-base text-foreground"
      />
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={200}
        value={set.reps}
        onChange={(e) => onChange({ reps: Math.max(0, Math.round(Number(e.target.value))) })}
        aria-label={`${t("gym.set")} ${index + 1} ${t("gym.reps")}`}
        className="input px-2 py-2 text-center text-base text-foreground"
      />
      <select
        value={set.rir ?? ""}
        onChange={(e) => onChange({ rir: e.target.value === "" ? null : Number(e.target.value) })}
        aria-label={`${t("gym.set")} ${index + 1} ${t("gym.rir")}`}
        className="input px-1 py-2 text-center text-base text-foreground"
      >
        <option value="">–</option>
        {[0, 1, 2, 3, 4].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button type="button" onClick={onRemove} aria-label={t("gym.removeSet")} className="px-1 text-lg text-muted">
        ×
      </button>
    </>
  );
}

function ExercisePicker({
  library,
  onPick,
  onCreated,
  onCancel,
}: {
  library: Exercise[];
  onPick: (id: string) => void;
  onCreated: (e: Exercise) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState<(typeof MUSCLE_GROUPS)[number]>("legs");
  const [equipment, setEquipment] = useState<(typeof EQUIPMENT)[number]>("barbell");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = library.filter((e) => !q || e.name.toLowerCase().includes(q));
  const groups = MUSCLE_GROUPS.map((g) => ({ g, items: filtered.filter((e) => e.muscleGroup === g) })).filter((x) => x.items.length);

  return (
    <div className="card flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("gym.search")}
        className="input"
        autoFocus
      />
      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        {groups.map(({ g, items }) => (
          <div key={g} className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t(`gym.muscleGroups.${g}`)}</span>
            {items.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onPick(e.id)}
                className="rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-primary"
              >
                {e.name}
                <span className="text-muted"> · {t(`gym.equipmentTypes.${e.equipment as (typeof EQUIPMENT)[number]}`)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {custom ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("gym.customName")} className="input" />
          <div className="grid grid-cols-2 gap-2">
            <select value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className="input" aria-label={t("gym.muscleGroup")}>
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {t(`gym.muscleGroups.${g}`)}
                </option>
              ))}
            </select>
            <select value={equipment} onChange={(e) => setEquipment(e.target.value as typeof equipment)} className="input" aria-label={t("gym.equipment")}>
              {EQUIPMENT.map((x) => (
                <option key={x} value={x}>
                  {t(`gym.equipmentTypes.${x}`)}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await createCustomExercise({ name, muscleGroup: group, equipment });
                if (res.error || !res.exercise) setError(res.error ?? null);
                else onCreated({ ...res.exercise, custom: true });
              })
            }
            className="btn-primary py-2.5 text-base"
          >
            {t("gym.createCustom")}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setCustom(true)} className="text-sm text-muted underline underline-offset-4">
          {t("gym.customExercise")}
        </button>
      )}
      <button type="button" onClick={onCancel} className="btn-secondary">
        {t("common.cancel")}
      </button>
    </div>
  );
}
