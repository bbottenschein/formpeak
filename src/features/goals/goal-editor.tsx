"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { updateGoalDate, updateGoalDescription, updateGoalFocuses } from "./actions";
import { GOAL_TYPES, type GoalType } from "./schema";

const chip = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-sm font-medium transition ${
    active ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface hover:border-muted/50"
  }`;

/** Ziel mit Sofort-Änderungen: Schwerpunkte antippen, Enddatum ändern, Beschreibung bearbeiten. */
export function GoalEditor({
  focuses,
  targetDate,
  description,
  today,
}: {
  focuses: GoalType[];
  targetDate: string | null;
  description: string;
  today: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState(focuses);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(description);

  const run = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className={`flex flex-col gap-4 ${pending ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("goalView.focuses")}>
        {GOAL_TYPES.map((type) => {
          const active = selected.includes(type);
          const disabled = (!active && selected.length >= 3) || (active && selected.length === 1);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              disabled={disabled || pending}
              onClick={() => {
                const next = active ? selected.filter((f) => f !== type) : [...selected, type];
                setSelected(next);
                run(() => updateGoalFocuses(next));
              }}
              className={`${chip(active)} ${disabled && !active ? "opacity-40" : ""}`}
            >
              {t(`goal.types.${type}`)}
            </button>
          );
        })}
      </div>

      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">{t("goalView.until")}</span>
        <input
          type="date"
          min={today}
          defaultValue={targetDate ?? ""}
          onChange={(e) => e.target.value && run(() => updateGoalDate(e.target.value))}
          className="input w-44 py-1.5"
        />
      </label>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} className="input resize-none" />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              disabled={pending || text.trim().length < 3}
              onClick={() => {
                setEditing(false);
                run(() => updateGoalDescription(text));
              }}
            >
              {t("goalView.save")}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="text-left text-sm text-muted">
          „{description}“ <span className="underline underline-offset-4">{t("goalView.editText")}</span>
        </button>
      )}
    </div>
  );
}
