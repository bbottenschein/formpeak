"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ensureReviewText } from "./actions";

/** Text zum Rückblick: kommt aus dem Speicher oder wird beim ersten Öffnen erzeugt. */
export function ReviewText({ kind, from, initial }: { kind: "week" | "month"; from: string; initial: string | null }) {
  const t = useT();
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (initial) return;
    let active = true;
    ensureReviewText(kind, from).then((r) => active && setText(r.text));
    return () => {
      active = false;
    };
  }, [kind, from, initial]);
  return <p className={`text-sm ${text ? "" : "text-muted"}`}>{text ?? t("review.writing")}</p>;
}
