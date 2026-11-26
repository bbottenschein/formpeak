"use client";

import { useEffect } from "react";

/** Registriert den Service Worker (nur im Produktivbetrieb). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.error("[sw]", e));
    }
  }, []);
  return null;
}
