"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PainPicker } from "@/features/bodymap/pain-picker";
import { ScaleInput } from "@/features/checkin/scale-input";
import type { GymSet } from "@/features/gym/logic";
import type { FeedbackInput } from "@/features/sessions/schema";
import { Info } from "@/features/ui/info";
import { useT } from "@/lib/i18n/client";
import { finishRoutine, finishTraining } from "./actions";
import { parsePrescription } from "./prescription";
import { Timer } from "./timer";

export interface FlowExercise {
  name: string;
  prescription: string;
  how: string;
  /** Gym-Übung aus der Bibliothek → Sätze werden hier eingetragen. */
  exerciseId: string | null;
  /** Letzte Arbeitssätze dieser Übung (Vorbelegung). */
  last: GymSet[] | null;
}

type Finish = { kind: "session"; id: string } | { kind: "routine"; key: string };

function initialSets(e: FlowExercise): GymSet[] {
  const p = parsePrescription(e.prescription);
  const lastWorking = e.last?.filter((s) => s.setType === "working") ?? [];
  const count = p.sets ?? (lastWorking.length || 3);
  return Array.from({ length: Math.min(count, 8) }, (_, i) => ({
    weightKg: p.weightKg ?? lastWorking[i]?.weightKg ?? lastWorking.at(-1)?.weightKg ?? 0,
    reps: p.reps ?? lastWorking[i]?.reps ?? 8,
    rir: null,
    setType: "working",
  }));
}

/**
 * Training als Klick-Through: Start → Übung 1 → Übung 2 → … → Feedback.
 * Gym-Übungen haben Satz-Felder, Zeitvorgaben einen Timer. Am Ende wird alles auf einmal gespeichert.
 */
export function TrainingFlow({
  title,
  durationMin,
  exercises,
  finish,
  closeHref,
}: {
  title: string;
  durationMin: number;
  exercises: FlowExercise[];
  finish: Finish;
  closeHref: string;
}) {
  const t = useT();
  const total = exercises.length;
  const [step, setStep] = useState(0); // 0 = Start, 1…total = Übungen, total + 1 = Feedback
  const [sets, setSets] = useState<GymSet[][]>(() => exercises.map((e) => (e.exerciseId ? initialSets(e) : [])));
  const [fb, setFb] = useState<FeedbackInput>({ durationMin, rpe: 5, fatigue: 3, matchMinutes: null, pains: [] });
  const [rpeSet, setRpeSet] = useState(false);
  const [hasPain, setHasPain] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0 });
  };
  const save = () =>
    startTransition(async () => {
      setError(false);
      const gymExercises = exercises
        .map((e, i) => ({ e, sets: sets[i] }))
        .filter(({ e, sets }) => e.exerciseId && sets.some((s) => s.reps > 0))
        .map(({ e, sets }) => ({ exerciseId: e.exerciseId!, note: e.prescription || null, sets: sets.filter((s) => s.reps > 0) }));
      const payload = {
        feedback: { ...fb, pains: hasPain ? fb.pains : [] },
        gym: gymExercises.length ? { exercises: gymExercises } : null,
      };
      const res = finish.kind === "session" ? await finishTraining(finish.id, payload) : await finishRoutine(finish.key, payload);
      if (res?.error) setError(true);
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

  // Start
  if (step === 0) {
    return (
      <section className="flex flex-col gap-6">
        {progress}
        <div>
          <p className="eyebrow">{t("training.minutesExercises", { minutes: durationMin, count: total })}</p>
          <h1 className="text-4xl font-bold">{title}</h1>
        </div>
        <ol className="flex flex-col divide-y divide-line border-y border-line">
          {exercises.map((e, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="flex items-baseline gap-3">
                <span className="font-display font-bold text-muted">{i + 1}</span>
                <span>{e.name}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted">{e.prescription}</span>
            </li>
          ))}
        </ol>
        <button className="btn-primary" onClick={() => go(1)}>
          {t("training.go")}
        </button>
      </section>
    );
  }

  // Übung
  if (step <= total) {
    const i = step - 1;
    const e = exercises[i];
    const p = parsePrescription(e.prescription);
    const last = e.last?.filter((s) => s.setType === "working") ?? [];
    return (
      <section className="flex flex-col gap-6">
        {progress}
        <div className="flex flex-col gap-2">
          <p className="eyebrow">{t("training.step", { n: step, total })}</p>
          <h1 className="text-4xl font-bold leading-tight">{e.name}</h1>
          {e.prescription && <p className="font-display text-3xl font-semibold tabular-nums">{e.prescription}</p>}
        </div>
        {e.how && <p className="text-base leading-relaxed">{e.how}</p>}

        {p.seconds != null && !e.exerciseId && <Timer key={step} seconds={p.seconds} />}

        {e.exerciseId && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">{t("training.sets")}</p>
              {last.length > 0 && (
                <span className="text-xs text-muted">
                  {t("training.last", { value: last.map((s) => `${s.reps}×${s.weightKg}`).join(" · ") })}
                </span>
              )}
            </div>
            {sets[i].map((s, j) => (
              <div key={j} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2">
                <span className="font-display text-lg font-bold text-muted">{j + 1}</span>
                <label className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    step={0.5}
                    min={0}
                    value={s.weightKg}
                    aria-label={t("training.kg")}
                    onChange={(ev) => {
                      const next = sets.map((row) => [...row]);
                      next[i][j] = { ...s, weightKg: Math.round(Number(ev.target.value) * 2) / 2 };
                      setSets(next);
                    }}
                    className="input text-center"
                  />
                  <span className="text-sm text-muted">{t("training.kg")}</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={s.reps}
                    aria-label={t("training.reps")}
                    onChange={(ev) => {
                      const next = sets.map((row) => [...row]);
                      next[i][j] = { ...s, reps: Math.max(0, Math.round(Number(ev.target.value))) };
                      setSets(next);
                    }}
                    className="input text-center"
                  />
                  <span className="text-sm text-muted">{t("training.reps")}</span>
                </label>
              </div>
            ))}
            <button
              type="button"
              className="self-start text-sm text-muted underline underline-offset-4"
              onClick={() => {
                const next = sets.map((row) => [...row]);
                next[i].push({ ...(next[i].at(-1) ?? { weightKg: 0, reps: 8, rir: null, setType: "working" }) });
                setSets(next);
              }}
            >
              + {t("training.addSet")}
            </button>
          </div>
        )}

        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button className="btn-secondary px-5" onClick={() => go(step - 1)} aria-label={t("training.back")}>
            ←
          </button>
          <button className="btn-primary" onClick={() => go(step + 1)}>
            {step === total ? t("training.toFeedback") : t("training.next")}
          </button>
        </div>
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
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={300}
          value={fb.durationMin}
          onChange={(ev) => setFb({ ...fb, durationMin: Math.max(1, Math.round(Number(ev.target.value))) })}
          className="input w-24 text-center"
        />
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
