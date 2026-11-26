"use client";

import { useActionState, useState } from "react";
import { PainPicker } from "@/features/bodymap/pain-picker";
import { ScaleInput } from "@/features/checkin/scale-input";
import { useT } from "@/lib/i18n/client";
import { saveFeedback, type SessionFormState } from "./actions";
import type { FeedbackInput } from "./schema";

export function FeedbackForm({
  sessionId,
  isMatch,
  initial,
}: {
  sessionId: string;
  isMatch: boolean;
  initial: FeedbackInput;
}) {
  const t = useT();
  const [v, setV] = useState<FeedbackInput>(initial);
  const [state, action, pending] = useActionState<SessionFormState, FormData>(
    saveFeedback.bind(null, sessionId),
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="payload" value={JSON.stringify(v)} />

      <fieldset className="flex flex-col gap-2">
        <legend className="eyebrow mb-2">{t("session.rpe")}</legend>
        <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label={t("session.rpe")}>
          {Array.from({ length: 11 }, (_, n) => n).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={v.rpe === n}
              onClick={() => setV({ ...v, rpe: n })}
              className={`h-11 rounded-md border font-display text-lg font-semibold ${
                v.rpe === n ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface"
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

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("session.duration")}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={300}
            value={v.durationMin}
            onChange={(e) => setV({ ...v, durationMin: Number(e.target.value) })}
            className="input"
          />
        </label>
        {isMatch && (
          <label className="flex flex-col gap-1.5">
            <span className="label">{t("session.matchMinutes")}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={150}
              value={v.matchMinutes ?? ""}
              onChange={(e) => setV({ ...v, matchMinutes: e.target.value === "" ? null : Number(e.target.value) })}
              className="input"
            />
          </label>
        )}
      </div>

      <ScaleInput
        label={t("session.fatigue")}
        value={v.fatigue}
        onChange={(fatigue) => setV({ ...v, fatigue })}
        lowLabel={t("session.fatigueLow")}
        highLabel={t("session.fatigueHigh")}
      />

      <PainPicker value={v.pains} onChange={(pains) => setV({ ...v, pains })} />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t("session.savingFeedback") : t("session.saveFeedback")}
      </button>
    </form>
  );
}
