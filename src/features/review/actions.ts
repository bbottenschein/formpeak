"use server";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { addDays, offseasonWeek } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { getGoal } from "@/features/goals/queries";
import { getOffseason } from "@/features/offseason/queries";
import { PLAN_MODEL } from "@/features/plan/ai";
import { hasAnthropicKey } from "@/lib/env.server";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { reviewHint } from "./logic";
import { getReviewData, type ReviewKind } from "./queries";

const Out = z.object({ text: z.string().describe("Rückblick in Du-Form, ohne Emojis, ohne Zahlenwiederholung aller Werte") });

const SYSTEM = `Du bist Athletiktrainer für Amateurfußballer und schreibst einen kurzen Rückblick.
- Woche: genau ein Satz – was nächste Woche am wichtigsten ist, begründet mit den Zahlen.
- Monat: zwei bis drei Sätze – was gut lief, was auffällt, worauf es im nächsten Monat ankommt.
- Sachlich, motivierend ohne Floskeln, Deutsch, Du-Form, keine Emojis, keine Diagnosen, keine Ernährungstipps.
- Erfinde keine Werte; nutze nur die Angaben. Bei Schmerzen nie zum Weitertrainieren raten.`;

/** Text zum Rückblick: einmal erzeugt (KI oder Regel) und gespeichert. */
export async function ensureReviewText(kind: ReviewKind, from: string): Promise<{ text: string | null }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return { text: null };
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  const supabase = await createClient();
  const { data: cached } = await supabase
    .from("reviews")
    .select("text")
    .eq("user_id", user.id)
    .eq("kind", kind)
    .eq("period_start", from)
    .maybeSingle();
  if (cached?.text) return { text: cached.text };

  const data = await getReviewData(supabase, user.id, kind, from, today);
  let text = t(`review.hints.${reviewHint(data.stats)}`);
  let source: "ai" | "rules" = "rules";
  if (hasAnthropicKey()) {
    try {
      const [goal, off] = await Promise.all([getGoal(user.id), getOffseason(supabase, user.id, data.to)]);
      const message = await new Anthropic().beta.messages.parse({
        model: PLAN_MODEL,
        max_tokens: 2000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(Out) },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              zeitraum: kind === "week" ? "woche" : "monat",
              von: data.from,
              bis: addDays(data.to, -1),
              einheiten_erledigt: data.stats.done,
              einheiten_geplant: data.stats.planned,
              last_au: data.stats.load,
              last_vorperiode_au: data.stats.prevLoad,
              last_veraenderung_prozent: data.stats.loadDelta,
              checkins: data.stats.checkins,
              tage: data.stats.days,
              bestwerte: data.bests.map((b) => ({ uebung: b.name, geschaetztes_1rm_kg: b.e1rm })),
              referenztests: data.tests,
              ziel: goal.goal ? { schwerpunkte: goal.goal.focuses, beschreibung: goal.goal.aiSummary || goal.goal.description } : null,
              naechste_woche_off_season: off ? { abschnitt: offseasonWeek(off.phase, data.to).block, entlastungswoche: offseasonWeek(off.phase, data.to).deload } : null,
            }),
          },
        ],
      });
      const parsed = message.stop_reason === "refusal" ? null : message.parsed_output;
      if (parsed?.text) {
        text = parsed.text.slice(0, 1200);
        source = "ai";
      }
    } catch (error) {
      console.error("[review] KI-Text fehlgeschlagen", error instanceof Error ? error.message : error);
    }
  }
  await supabase.from("reviews").upsert(
    { user_id: user.id, kind, period_start: from, stats: { ...data.stats, bests: data.bests.length }, text, source },
    { onConflict: "user_id,kind,period_start" },
  );
  return { text };
}
