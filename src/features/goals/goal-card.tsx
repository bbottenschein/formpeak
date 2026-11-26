import Link from "next/link";
import type { Translate } from "@/lib/i18n/translate";
import type { GoalInput } from "./schema";

const formatDate = (d: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const num = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

/** Ziel in der Übersicht – oder Aufforderung, eins festzulegen. */
export function GoalCard({ goal, t }: { goal: GoalInput | null; t: Translate }) {
  if (!goal) {
    return (
      <div className="card flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{t("goal.cardEmptyTitle")}</h2>
        <p className="text-sm text-muted">{t("goal.cardEmptyText")}</p>
        <Link href="/goals" className="btn-primary text-center">
          {t("goal.cardCta")}
        </Link>
      </div>
    );
  }
  return (
    <Link href="/goals" className="card flex flex-col gap-1.5 transition hover:border-muted/50">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="eyebrow">{t("goal.cardTitle")}</h2>
        <span className="text-xs text-muted">{t(`goal.types.${goal.type}`)}</span>
      </div>
      <p className="font-medium">{goal.description}</p>
      {goal.testName && goal.targetValue != null && (
        <p className="text-sm">
          {goal.testName}: {goal.baselineValue != null ? `${num(goal.baselineValue)} → ` : ""}
          <span className="font-display font-semibold">
            {num(goal.targetValue)} {goal.unit}
          </span>
          {goal.targetDate && <span className="text-muted"> · {t("goal.cardUntil", { date: formatDate(goal.targetDate) })}</span>}
        </p>
      )}
      <p className="text-xs text-muted">
        {t("goal.cardFrame", { sessions: goal.extraSessionsPerWeek, minutes: goal.timeBudgetMin })}
      </p>
    </Link>
  );
}
