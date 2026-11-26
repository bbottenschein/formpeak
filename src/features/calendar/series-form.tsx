"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createSeries, type SeriesState } from "./actions";
import { RPE_FOR_INTENSITY } from "./series";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
type Intensity = "low" | "medium" | "high";

const chip = (active: boolean) =>
  `rounded-lg border px-2 py-2 text-sm font-medium transition ${
    active ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface hover:border-muted/50"
  }`;

/** Nach dem Speichern setzt die Seite einen neuen `key`, dadurch startet das Formular leer. */
export function SeriesForm({ today }: { today: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<SeriesState, FormData>(createSeries, {});
  const [kind, setKind] = useState<"training" | "match">("training");
  const [days, setDays] = useState<number[]>([]);
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [rpe, setRpe] = useState(RPE_FOR_INTENSITY.medium);
  const [time, setTime] = useState("19:00");

  function chooseKind(k: "training" | "match") {
    setKind(k);
    const i: Intensity = k === "match" ? "high" : "medium";
    setIntensity(i);
    setRpe(k === "match" ? 8 : RPE_FOR_INTENSITY[i]);
    setTime(k === "match" ? "15:00" : "19:00");
  }

  return (
    <form action={action} className="card flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="expectedIntensity" value={intensity} />
      {days.map((d) => (
        <input key={d} type="hidden" name="weekdays" value={d} />
      ))}

      <div className="flex flex-col gap-1.5">
        <span className="label">{t("calendar.kind")}</span>
        <div className="grid grid-cols-2 gap-1.5">
          {(["training", "match"] as const).map((k) => (
            <button key={k} type="button" onClick={() => chooseKind(k)} className={chip(kind === k)}>
              {t(`sessionTypes.${k}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="label">{t("calendar.weekdays")}</span>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days.includes(d)}
              onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
              className={chip(days.includes(d))}
            >
              {t(`weekdays.short.${d}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("calendar.startTime")}</span>
          <input name="startTime" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("calendar.duration")}</span>
          <input name="durationMin" type="number" inputMode="numeric" min={15} max={300} defaultValue={90} className="input" />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="label">{t("calendar.expectedIntensity")}</span>
        <div className="grid grid-cols-3 gap-1.5">
          {(["low", "medium", "high"] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setIntensity(i);
                if (kind === "training") setRpe(RPE_FOR_INTENSITY[i]);
              }}
              className={chip(intensity === i)}
            >
              {t(`intensity.${i}`)}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="label">{t("calendar.defaultRpe")}</span>
        <input
          name="defaultRpe"
          type="number"
          inputMode="numeric"
          min={0}
          max={10}
          value={rpe}
          onChange={(e) => setRpe(Number(e.target.value))}
          className="input"
        />
        <span className="text-xs text-muted">{t("calendar.defaultRpeHint")}</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("calendar.validFrom")}</span>
          <input name="validFrom" type="date" defaultValue={today} required className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">
            {t("calendar.validUntil")} <span className="text-muted/70">· {t("common.optional")}</span>
          </span>
          <input name="validUntil" type="date" className="input" />
        </label>
      </div>
      <p className="text-xs text-muted">{t("calendar.validFromHint")}</p>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending || days.length === 0} className="btn-primary">
        {pending ? t("calendar.saving") : t("calendar.save")}
      </button>
    </form>
  );
}
