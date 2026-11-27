"use client";

import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";

export function ReplanButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button className="btn-secondary flex-1" disabled={pending}>
      {pending ? t("plan.replanning") : t("plan.replan")}
    </button>
  );
}
