"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { ensureWeekPlan, replanWeek } from "./actions";

/**
 * Startet die Planung der Woche, sobald die Seite ohne Plan geöffnet wird, und lädt neu,
 * wenn der Plan fertig ist. Läuft die Planung schon (anderer Tab), wird regelmäßig nachgesehen.
 */
export function PlanAutoStart({ weekStart, status }: { weekStart: string; status: "none" | "pending" | "failed" }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(status === "failed");
  const started = useRef(false);

  useEffect(() => {
    if (status === "none" && !started.current) {
      started.current = true;
      startTransition(async () => {
        const res = await ensureWeekPlan(weekStart);
        if (!res.ok) setFailed(true);
        router.refresh();
      });
    }
    if (status === "pending") {
      const id = setInterval(() => router.refresh(), 5000);
      return () => clearInterval(id);
    }
  }, [status, weekStart, router]);

  if (failed && !pending) {
    return (
      <div className="card flex flex-col gap-3">
        <p className="text-sm">{t("plan.failed")}</p>
        <button
          className="btn-secondary"
          onClick={() =>
            startTransition(async () => {
              setFailed(false);
              await replanWeek(weekStart);
              router.refresh();
            })
          }
        >
          {t("plan.retry")}
        </button>
      </div>
    );
  }
  return (
    <div className="card flex items-center gap-3" role="status">
      <span aria-hidden className="size-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-primary" />
      <p className="text-sm">{t("plan.creating")}</p>
    </div>
  );
}
