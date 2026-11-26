"use client";

import { useActionState, useState } from "react";
import type { GymFocus, SessionType } from "@/core/load";
import { DEFAULT_RPE } from "@/features/calendar/series";
import { useT } from "@/lib/i18n/client";
import { createSession, type SessionFormState } from "./actions";
import type { NewSessionInput } from "./schema";

const EXTRA_TYPES: SessionType[] = ["gym", "run_intervals", "mobility", "recovery"];
const FIXTURE_TYPES: SessionType[] = ["training", "match"];
const DEFAULT_DURATION: Record<SessionType, number> = {
  training: 90,
  match: 90,
  gym: 45,
  run_intervals: 30,
  mobility: 20,
  recovery: 30,
};

const chip = (active: boolean) =>
  `rounded-lg border px-2 py-2 text-sm font-medium transition ${
    active ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface hover:border-muted/50"
  }`;

/** Neue Zusatzeinheit (Gym, Lauf, Mobilität, Regeneration) oder Einzeltermin (Training, Spiel). */
export function NewSessionForm({ date, fixture }: { date: string; fixture: boolean }) {
  const t = useT();
  const types = fixture ? FIXTURE_TYPES : EXTRA_TYPES;
  const [state, action, pending] = useActionState<SessionFormState, FormData>(createSession, {});
  const [v, setV] = useState<NewSessionInput>({
    type: types[0],
    date,
    startTime: null,
    durationMin: DEFAULT_DURATION[types[0]],
    targetRpe: fixture ? null : DEFAULT_RPE[types[0]],
    gymFocus: types[0] === "gym" ? "full" : null,
    expectedIntensity: fixture ? "medium" : null,
    notes: null,
  });

  function chooseType(type: SessionType) {
    setV({
      ...v,
      type,
      durationMin: DEFAULT_DURATION[type],
      targetRpe: fixture ? null : DEFAULT_RPE[type],
      gymFocus: type === "gym" ? (v.gymFocus ?? "full") : null,
      expectedIntensity: fixture ? (type === "match" ? "high" : "medium") : null,
    });
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="payload" value={JSON.stringify(v)} />

      <div className="flex flex-col gap-1.5">
        <span className="label">{t("session.type")}</span>
        <div className={`grid gap-1.5 ${fixture ? "grid-cols-2" : "grid-cols-2"}`}>
          {types.map((type) => (
            <button key={type} type="button" onClick={() => chooseType(type)} className={chip(v.type === type)}>
              {t(`sessionTypes.${type}`)}
            </button>
          ))}
        </div>
      </div>

      {v.type === "gym" && (
        <div className="flex flex-col gap-1.5">
          <span className="label">{t("session.gymFocus")}</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(["lower", "upper", "full"] as GymFocus[]).map((f) => (
              <button key={f} type="button" onClick={() => setV({ ...v, gymFocus: f })} className={chip(v.gymFocus === f)}>
                {t(`gymFocus.${f}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("session.date")}</span>
          <input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} required className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("session.time")}</span>
          <input
            type="time"
            value={v.startTime ?? ""}
            onChange={(e) => setV({ ...v, startTime: e.target.value || null })}
            className="input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="label">{t("session.duration")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={5}
          max={300}
          value={v.durationMin}
          onChange={(e) => setV({ ...v, durationMin: Number(e.target.value) })}
          className="input"
        />
      </label>

      {fixture ? (
        <div className="flex flex-col gap-1.5">
          <span className="label">{t("calendar.expectedIntensity")}</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(["low", "medium", "high"] as const).map((i) => (
              <button key={i} type="button" onClick={() => setV({ ...v, expectedIntensity: i })} className={chip(v.expectedIntensity === i)}>
                {t(`intensity.${i}`)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="label">{t("session.targetRpe")}</span>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => n).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setV({ ...v, targetRpe: n })}
                className={`h-10 rounded-md border font-display font-semibold ${
                  v.targetRpe === n ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="label">
          {t("session.notes")} <span className="text-muted/70">· {t("common.optional")}</span>
        </span>
        <input
          value={v.notes ?? ""}
          onChange={(e) => setV({ ...v, notes: e.target.value || null })}
          maxLength={500}
          className="input"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t("session.creating") : t("session.create")}
      </button>
    </form>
  );
}
