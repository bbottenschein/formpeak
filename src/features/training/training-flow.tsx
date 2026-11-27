"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { PainPicker } from "@/features/bodymap/pain-picker";
import { ScaleInput } from "@/features/checkin/scale-input";
import { isPersonalBest, REST_SECONDS, suggestWeight, type GymSet } from "@/features/gym/logic";
import type { FeedbackInput } from "@/features/sessions/schema";
import { Info } from "@/features/ui/info";
import { useT } from "@/lib/i18n/client";
import { finishRoutine, finishTraining } from "./actions";
import { ExerciseSwap, type LibraryItem } from "./exercise-swap";
import { NumField } from "./num-field";
import { parsePrescription, type Measure } from "./prescription";
import { RestTimer } from "./rest-timer";
import { Timer } from "./timer";

export interface FlowExercise {
  name: string;
  prescription: string;
  how: string;
  /** Gym-Übung aus der Bibliothek → Sätze landen im Gym-Log. */
  exerciseId: string | null;
  measure: Measure;
  /** Letzte Arbeitssätze dieser Übung (Vorbelegung). */
  last: GymSet[] | null;
  /** Bisher bestes geschätztes 1RM (für „Bestwert“). */
  best?: number | null;
}

type Finish = { kind: "session"; id: string } | { kind: "routine"; key: string };

/** Ein Satz im Training: Felder dürfen leer sein, solange getippt wird. */
interface FlowSet {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  done: boolean;
}

interface Item {
  ex: FlowExercise;
  sets: FlowSet[];
}

function initialSets(e: FlowExercise): FlowSet[] {
  const p = parsePrescription(e.prescription);
  const lastWorking = e.last?.filter((s) => s.setType === "working") ?? [];
  const count = Math.min(p.sets ?? (lastWorking.length || (e.measure === "check" || e.measure === "time" ? 1 : 3)), 8);
  const suggested = e.measure === "weight_reps" ? suggestWeight(lastWorking, p.reps) : null;
  return Array.from({ length: count }, (_, i) => ({
    weightKg: e.measure === "weight_reps" ? (suggested?.weightKg ?? p.weightKg ?? lastWorking[i]?.weightKg ?? null) : null,
    reps: e.measure === "weight_reps" || e.measure === "reps" ? (p.reps ?? lastWorking[i]?.reps ?? null) : null,
    seconds: e.measure === "time" ? p.seconds : null,
    done: false,
  }));
}

const itemsFrom = (exercises: FlowExercise[]): Item[] => exercises.map((ex) => ({ ex, sets: initialSets(ex) }));
const planKey = (exercises: FlowExercise[]) => exercises.map((e) => `${e.name}|${e.prescription}`).join("§");

interface Saved {
  key: string;
  step: number;
  items: Item[];
  restUntil: number | null;
}

/**
 * Training als Klick-Through: Übersicht (Reihenfolge ändern, Übung tauschen) → Übung für Übung →
 * Feedback. Der Stand wird auf dem Gerät gespeichert, der Bildschirm bleibt an.
 */
export function TrainingFlow({
  title,
  durationMin,
  exercises,
  library,
  finish,
  closeHref,
}: {
  title: string;
  durationMin: number;
  exercises: FlowExercise[];
  library: LibraryItem[];
  finish: Finish;
  closeHref: string;
}) {
  const t = useT();
  const storageKey = `formpeak:training:${finish.kind === "session" ? finish.id : finish.key}`;
  const key = planKey(exercises);

  // Gespeicherten Stand übernehmen (gleicher Plan), sonst neu beginnen.
  const [saved] = useState<Saved | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const s = raw ? (JSON.parse(raw) as Saved) : null;
      return s && s.key === key ? s : null;
    } catch {
      return null;
    }
  });
  const [items, setItems] = useState<Item[]>(saved?.items ?? itemsFrom(exercises));
  const [step, setStep] = useState(saved?.step ?? 0); // 0 = Übersicht, 1…n = Übungen, n + 1 = Feedback
  const [restUntil, setRestUntil] = useState<number | null>(saved?.restUntil ?? null);
  const [planSeen, setPlanSeen] = useState(key);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [fb, setFb] = useState<FeedbackInput>({ durationMin, rpe: 5, fatigue: 3, matchMinutes: null, pains: [] });
  const [rpeSet, setRpeSet] = useState(false);
  const [hasPain, setHasPain] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const total = items.length;

  // Plan wurde von außen geändert (z. B. vom KI-Chat): noch nicht begonnene Übungen übernehmen.
  if (key !== planSeen) {
    setPlanSeen(key);
    const fresh = itemsFrom(exercises);
    setItems(fresh.map((f, i) => (items[i] && items[i].sets.some((s) => s.done) ? items[i] : f)));
  }

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ key, step, items, restUntil } satisfies Saved));
    } catch {
      // Speicher voll oder privat – Training läuft trotzdem.
    }
  }, [storageKey, key, step, items, restUntil]);

  // Bildschirm während des Trainings anlassen (iOS ab 16.4, Android).
  const lock = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    const request = async () => {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator) lock.current = await navigator.wakeLock.request("screen");
      } catch {
        // nicht unterstützt
      }
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      lock.current?.release().catch(() => {});
    };
  }, []);

  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0 });
  };
  const updateSet = (i: number, j: number, patch: Partial<FlowSet>) =>
    setItems((prev) => prev.map((it, k) => (k === i ? { ...it, sets: it.sets.map((s, l) => (l === j ? { ...s, ...patch } : s)) } : it)));
  const move = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });

  const save = () =>
    startTransition(async () => {
      setError(false);
      const gym = items
        .filter((it) => it.ex.exerciseId && (it.ex.measure === "weight_reps" || it.ex.measure === "reps"))
        .map((it) => ({
          exerciseId: it.ex.exerciseId!,
          note: it.ex.prescription || null,
          sets: it.sets
            .filter((s) => (s.reps ?? 0) > 0)
            .map((s): GymSet => ({ weightKg: s.weightKg ?? 0, reps: s.reps ?? 0, rir: null, setType: "working" })),
        }))
        .filter((g) => g.sets.length > 0);
      const payload = {
        feedback: { ...fb, pains: hasPain ? fb.pains : [] },
        gym: gym.length ? { exercises: gym } : null,
        plan: items.map((it) => ({
          name: it.ex.name,
          prescription: it.ex.prescription,
          how: it.ex.how,
          exerciseId: it.ex.exerciseId,
          measure: it.ex.measure,
        })),
      };
      const res = finish.kind === "session" ? await finishTraining(finish.id, payload) : await finishRoutine(finish.key, payload);
      if (res?.error) setError(true);
      else {
        try {
          localStorage.removeItem(storageKey);
        } catch {}
      }
    });

  const progress = (
    <div className="flex items-center gap-3">
      <Link href={closeHref} aria-label={t("training.close")} className="text-muted hover:text-foreground">
        <svg viewBox="0 0 20 20" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
        </svg>
      </Link>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: total + 1 }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-primary" : "bg-line"}`} />
        ))}
      </div>
      <span className="text-sm tabular-nums text-muted">
        {Math.min(step, total)}/{total}
      </span>
    </div>
  );

  const swapSheet =
    swapIndex != null ? (
      <ExerciseSwap
        current={items[swapIndex].ex}
        library={library}
        onClose={() => setSwapIndex(null)}
        onPick={(ex) => {
          setItems((prev) => prev.map((it, k) => (k === swapIndex ? { ex, sets: initialSets(ex) } : it)));
          setSwapIndex(null);
        }}
      />
    ) : null;

  // Übersicht
  if (step === 0) {
    return (
      <section className="flex flex-col gap-6">
        {progress}
        <div>
          <p className="eyebrow">{t("training.minutesExercises", { minutes: durationMin, count: total })}</p>
          <h1 className="text-4xl font-bold">{title}</h1>
        </div>
        <ol className="flex flex-col divide-y divide-line border-y border-line">
          {items.map((it, i) => (
            <li key={`${it.ex.name}-${i}`} className="flex items-center gap-2 py-2">
              <span className="flex flex-col">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("training.up")} className="p-1 text-muted disabled:opacity-20">
                  <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M5 12.5l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button type="button" disabled={i === total - 1} onClick={() => move(i, 1)} aria-label={t("training.down")} className="p-1 text-muted disabled:opacity-20">
                  <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{it.ex.name}</span>
                <span className="text-sm tabular-nums text-muted">{it.ex.prescription}</span>
              </span>
              <button type="button" onClick={() => setSwapIndex(i)} className="shrink-0 text-sm text-muted underline underline-offset-4">
                {t("training.swap")}
              </button>
            </li>
          ))}
        </ol>
        <button className="btn-primary" onClick={() => go(1)}>
          {saved && saved.step > 0 ? t("training.resumeTraining") : t("training.go")}
        </button>
        {swapSheet}
      </section>
    );
  }

  // Übung
  if (step <= total) {
    const i = step - 1;
    const { ex: e, sets } = items[i];
    const p = parsePrescription(e.prescription);
    const last = e.last?.filter((s) => s.setType === "working") ?? [];
    const strength = e.measure === "weight_reps" || e.measure === "reps";
    return (
      <section className="flex flex-col gap-6">
        {progress}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow">{t("training.step", { n: step, total })}</p>
            <button type="button" onClick={() => setSwapIndex(i)} className="text-sm text-muted underline underline-offset-4">
              {t("training.swap")}
            </button>
          </div>
          <h1 className="text-4xl font-bold leading-tight">{e.name}</h1>
          {e.prescription && <p className="font-display text-3xl font-semibold tabular-nums">{e.prescription}</p>}
        </div>
        {e.how && <p className="text-base leading-relaxed">{e.how}</p>}

        {e.measure === "check" && p.seconds != null && <Timer key={`${step}-t`} seconds={p.seconds} />}

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">{t("training.sets")}</p>
            {last.length > 0 && e.measure === "weight_reps" && (
              <span className="text-xs text-muted">
                {t("training.last", { value: last.map((s) => `${s.reps}×${s.weightKg}`).join(" · ") })}
                {suggestWeight(last, p.reps)?.progressed && ` · ${t("training.progress")}`}
              </span>
            )}
          </div>
          {sets.map((s, j) => (
            <div key={j} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-6 font-display text-lg font-bold text-muted">{j + 1}</span>
                {e.measure === "weight_reps" && (
                  <label className="flex flex-1 items-center gap-1.5">
                    <NumField decimal value={s.weightKg} onChange={(v) => updateSet(i, j, { weightKg: v })} label={t("training.kg")} />
                    <span className="text-sm text-muted">{t("training.kg")}</span>
                  </label>
                )}
                {(e.measure === "weight_reps" || e.measure === "reps") && (
                  <label className="flex flex-1 items-center gap-1.5">
                    <NumField value={s.reps} onChange={(v) => updateSet(i, j, { reps: v })} label={t("training.reps")} />
                    <span className="text-sm text-muted">{t("training.reps")}</span>
                  </label>
                )}
                {e.measure === "time" && (
                  <div className="flex-1">
                    <Timer key={`${step}-${j}`} seconds={s.seconds ?? 30} />
                  </div>
                )}
                {e.measure === "check" && <span className="flex-1" />}
                <button
                  type="button"
                  aria-pressed={s.done}
                  aria-label={t("training.setDone", { n: j + 1 })}
                  onClick={() => {
                    updateSet(i, j, { done: !s.done });
                    if (!s.done && strength) setRestUntil(Date.now() + REST_SECONDS * 1000);
                  }}
                  className={`flex size-11 shrink-0 items-center justify-center rounded-lg border transition ${
                    s.done ? "border-primary bg-primary text-primary-foreground" : "border-line text-muted"
                  }`}
                >
                  <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {s.done && e.measure === "weight_reps" && isPersonalBest({ weightKg: s.weightKg ?? 0, reps: s.reps ?? 0 }, e.best ?? null) && (
                <span className="pl-8 text-xs font-semibold uppercase tracking-wide">{t("training.personalBest")}</span>
              )}
            </div>
          ))}
          <button
            type="button"
            className="self-start text-sm text-muted underline underline-offset-4"
            onClick={() =>
              setItems((prev) =>
                prev.map((it, k) =>
                  k === i ? { ...it, sets: [...it.sets, { ...(it.sets.at(-1) ?? { weightKg: null, reps: null, seconds: null }), done: false }] } : it,
                ),
              )
            }
          >
            + {t("training.addSet")}
          </button>
        </div>

        {restUntil && <RestTimer until={restUntil} onChange={setRestUntil} onDone={() => setRestUntil(null)} />}

        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button className="btn-secondary px-5" onClick={() => go(step - 1)} aria-label={t("training.back")}>
            ←
          </button>
          <button className="btn-primary" onClick={() => go(step + 1)}>
            {step === total ? t("training.toFeedback") : t("training.next")}
          </button>
        </div>
        {swapSheet}
      </section>
    );
  }

  // Feedback
  return (
    <section className="flex flex-col gap-7">
      {progress}
      <h1 className="text-4xl font-bold">{t("training.feedbackTitle")}</h1>

      <fieldset className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <legend className="eyebrow">{t("training.rpeQuestion")}</legend>
          <Info title={t("training.rpeInfoTitle")}>
            <p>{t("training.rpeInfo")}</p>
          </Info>
        </div>
        <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label={t("training.rpeQuestion")}>
          {Array.from({ length: 11 }, (_, n) => n).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rpeSet && fb.rpe === n}
              onClick={() => {
                setFb({ ...fb, rpe: n });
                setRpeSet(true);
              }}
              className={`h-11 rounded-md border font-display text-lg font-semibold ${
                rpeSet && fb.rpe === n ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted">
          <span>{t("session.rpeLow")}</span>
          <span>{t("session.rpeHigh")}</span>
        </div>
      </fieldset>

      <ScaleInput
        label={t("session.fatigue")}
        value={fb.fatigue}
        onChange={(fatigue) => setFb({ ...fb, fatigue })}
        lowLabel={t("session.fatigueLow")}
        highLabel={t("session.fatigueHigh")}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="eyebrow mb-2">{t("training.painQuestion")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={hasPain === v}
              onClick={() => setHasPain(v)}
              className={`h-12 rounded-lg border font-display text-lg font-semibold uppercase ${
                hasPain === v ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface"
              }`}
            >
              {v ? t("training.yes") : t("training.no")}
            </button>
          ))}
        </div>
        {hasPain && <PainPicker value={fb.pains} onChange={(pains) => setFb({ ...fb, pains })} />}
      </fieldset>

      <label className="flex items-center justify-between gap-3">
        <span className="eyebrow">{t("training.duration")}</span>
        <span className="w-24">
          <NumField value={fb.durationMin} onChange={(v) => setFb({ ...fb, durationMin: Math.max(1, v ?? 1) })} label={t("training.duration")} />
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {t("training.error")}
        </p>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button className="btn-secondary px-5" onClick={() => go(total)} aria-label={t("training.back")}>
          ←
        </button>
        <button className="btn-primary" disabled={!rpeSet || pending} onClick={save}>
          {pending ? t("training.saving") : t("training.save")}
        </button>
      </div>
    </section>
  );
}
