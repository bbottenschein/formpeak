"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "@/features/notifications/actions";
import { Info } from "@/features/ui/info";
import { useT } from "@/lib/i18n/client";

export interface SettingsValues {
  displayName: string;
  timezone: string;
  morningReminder: string;
  eveningReminder: string;
  pushMorning: boolean;
  pushEvening: boolean;
  pushFeedback: boolean;
}

const TIMEZONES = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "Europe/London", "Europe/Madrid", "America/New_York"];

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const t = useT();
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const zones = TIMEZONES.includes(initial.timezone) ? TIMEZONES : [initial.timezone, ...TIMEZONES];

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="card flex flex-col divide-y divide-line p-0">
        {(["morning", "evening"] as const).map((k) => (
          <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name={k === "morning" ? "pushMorning" : "pushEvening"}
                defaultChecked={k === "morning" ? initial.pushMorning : initial.pushEvening}
                className="size-5 accent-primary"
              />
              <span>{t(k === "morning" ? "settings.morningReminder" : "settings.eveningReminder")}</span>
            </label>
            <input
              type="time"
              name={k === "morning" ? "morningReminder" : "eveningReminder"}
              defaultValue={(k === "morning" ? initial.morningReminder : initial.eveningReminder).slice(0, 5)}
              required
              className="input w-28 py-1.5"
            />
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <label className="flex items-center gap-3">
            <input type="checkbox" name="pushFeedback" defaultChecked={initial.pushFeedback} className="size-5 accent-primary" />
            <span>{t("settings.feedbackReminder")}</span>
          </label>
          <Info title={t("settings.feedbackReminder")}>
            <p>{t("settings.feedbackReminderHint")}</p>
          </Info>
        </div>
      </div>

      <div className="card flex flex-col divide-y divide-line p-0">
        <label className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span>{t("settings.displayName")}</span>
          <input name="displayName" defaultValue={initial.displayName} required maxLength={40} className="input w-40 py-1.5 text-right" />
        </label>
        <label className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span>{t("settings.timezone")}</span>
          <select name="timezone" defaultValue={initial.timezone} className="input w-40 py-1.5">
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? t("settings.saving") : state.ok ? t("settings.saved") : t("settings.save")}
      </button>
    </form>
  );
}
