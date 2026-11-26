"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "@/features/notifications/actions";
import { useT } from "@/lib/i18n/client";

export interface SettingsValues {
  displayName: string;
  timezone: string;
  morningReminder: string;
  eveningReminder: string;
  pushMorning: boolean;
  pushEvening: boolean;
}

const TIMEZONES = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "Europe/London", "Europe/Madrid", "America/New_York"];

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const t = useT();
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const zones = TIMEZONES.includes(initial.timezone) ? TIMEZONES : [initial.timezone, ...TIMEZONES];

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="eyebrow">{t("settings.notifications")}</h2>
        {(["morning", "evening"] as const).map((k) => (
          <div key={k} className="card flex items-center justify-between gap-3 py-3">
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
              className="input w-32"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="eyebrow">{t("settings.profile")}</h2>
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("settings.displayName")}</span>
          <input name="displayName" defaultValue={initial.displayName} required maxLength={40} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">{t("settings.timezone")}</span>
          <select name="timezone" defaultValue={initial.timezone} className="input">
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
      {state.ok && <p className="text-sm text-primary">{t("settings.saved")}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t("settings.saving") : t("settings.save")}
      </button>
    </form>
  );
}
