"use client";

import { useEffect, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { removePushSubscription, savePushSubscription, sendTestPush } from "./actions";

type Status = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function currentStatus(): Promise<Status> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIos() && !isStandalone() ? "install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.ready;
  return (await registration.pushManager.getSubscription()) ? "on" : "off";
}

/** Benachrichtigungen auf diesem Gerät ein- und ausschalten. */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    // Ohne Service Worker (z. B. im Entwicklungsmodus) wartet `ready` ewig.
    const timeout = setTimeout(() => active && setStatus((s) => (s === "loading" ? "unsupported" : s)), 4000);
    currentStatus()
      .then((s) => active && setStatus(s))
      .catch(() => active && setStatus("unsupported"));
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  function enable() {
    setMessage(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey!),
        });
        const result = await savePushSubscription(subscription.toJSON());
        if (!result.ok) {
          setMessage(t("settings.failed"));
          return;
        }
        setStatus("on");
        const test = await sendTestPush();
        setMessage(test.sent > 0 ? t("settings.enabled") : t("settings.enabledNoTest"));
      } catch {
        setMessage(t("settings.failed"));
      }
    });
  }

  function disable() {
    setMessage(null);
    startTransition(async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
    });
  }

  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p>{t("settings.device")}</p>
          {(status === "on" || status === "off") && (
            <p className={`text-sm ${status === "on" ? "text-foreground" : "text-muted"}`}>
              {status === "on" ? t("settings.on") : t("settings.off")}
            </p>
          )}
        </div>
        {publicKey && status === "on" && (
          <button type="button" disabled={pending} onClick={disable} className="btn-secondary px-3 py-1.5 text-sm">
            {t("settings.disable")}
          </button>
        )}
        {publicKey && status === "off" && (
          <button type="button" disabled={pending} onClick={enable} className="btn-primary px-3 py-1.5 text-sm">
            {t("settings.enable")}
          </button>
        )}
      </div>
      {!publicKey && <p className="text-sm text-muted">{t("settings.noVapid")}</p>}
      {publicKey && status === "install" && <p className="text-sm text-muted">{t("settings.iosInstall")}</p>}
      {publicKey && status === "denied" && <p className="text-sm text-muted">{t("settings.denied")}</p>}
      {publicKey && status === "unsupported" && <p className="text-sm text-muted">{t("settings.unsupported")}</p>}
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
