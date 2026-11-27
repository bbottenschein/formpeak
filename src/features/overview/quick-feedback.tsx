"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { quickFeedback } from "@/features/sessions/actions";
import { useT } from "@/lib/i18n/client";

/** RPE einer Einheit mit einem Tipp nachtragen (aus der Übersicht). */
export function QuickFeedback({ sessionId, title, meta }: { sessionId: string; title: string; meta: string }) {
  const t = useT();
  const [picked, setPicked] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function pick(rpe: number) {
    setPicked(rpe);
    startTransition(async () => {
      const res = await quickFeedback(sessionId, rpe);
      setSaved(res.ok);
    });
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold uppercase tracking-wide">{title}</p>
          <p className="text-xs text-muted">{meta}</p>
        </div>
        <Link href={`/sessions/${sessionId}`} aria-label={t("overview.feedbackDetails")} className="text-muted hover:text-foreground">
          →
        </Link>
      </div>
      <p className="eyebrow text-xs">{t("overview.rpeHint")}</p>
      <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label="RPE">
        {Array.from({ length: 11 }, (_, n) => n).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={picked === n}
            disabled={pending || saved}
            onClick={() => pick(n)}
            className={`h-10 rounded-md border font-display text-base font-semibold ${
              picked === n ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface"
            } disabled:opacity-70`}
          >
            {n}
          </button>
        ))}
      </div>
      {saved && <p className="text-sm text-primary">{t("overview.feedbackSaved")}</p>}
    </div>
  );
}
