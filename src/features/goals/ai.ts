import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { hasAnthropicKey } from "@/lib/env.server";
import type { EQUIPMENT_OPTIONS, GOAL_TYPES } from "./schema";
import { SELF_TESTS, TEST_KEYS, suggestTests, type TestKey } from "./tests";

export interface GoalContext {
  type: (typeof GOAL_TYPES)[number];
  /** Alle Schwerpunkte (der erste = type). */
  focuses?: (typeof GOAL_TYPES)[number][];
  description: string;
  extraSessionsPerWeek: number;
  timeBudgetMin: number;
  availableWeekdays: number[];
  equipment: (typeof EQUIPMENT_OPTIONS)[number][];
  targetDate: string | null;
  today: string;
}

const GoalSummary = z.object({
  summary: z.string().describe("Ziel in 1–2 Sätzen, Du-Form, beginnt mit „Du willst“"),
  focus: z.array(z.string()).max(3).describe("Bis zu 3 kurze Trainingsschwerpunkte"),
  testKey: z.enum(TEST_KEYS).describe("Passendster Selbsttest aus der Liste"),
});

export type GoalSummaryResult = z.infer<typeof GoalSummary> & { source: "ai" | "rules" };

const SYSTEM = `Du bist Athletiktrainer für Amateurfußball. Aus den Angaben eines Spielers formulierst du sein Trainingsziel klar und motivierend, aber realistisch.

Regeln:
- Antworte auf Deutsch, in der Du-Form. "summary" beginnt mit "Du willst" und nennt das Zieldatum, falls angegeben.
- Übernimm, was der Spieler will; erfinde keine Zahlen, die er nicht genannt hat.
- Keine Diagnosen, keine medizinischen Aussagen. Bei Schmerzen oder Verletzungen nur auf ärztliche Abklärung verweisen.
- "focus": höchstens drei kurze Schwerpunkte (z. B. "Intervalle", "Unterkörperkraft"), passend zum Trainingsrahmen.
- "testKey": wähle aus den angebotenen Tests den passendsten für den ersten Schwerpunkt, der mit den verfügbaren Trainingsmitteln machbar ist.
- Mehrere Schwerpunkte (z. B. Schnelligkeit und Muskelaufbau) gemeinsam in einem Satz formulieren.`;

/** Regelbasierte Zusammenfassung – wenn kein API-Schlüssel da ist oder die KI ausfällt. */
export function rulesSummary(ctx: GoalContext): GoalSummaryResult {
  return { summary: "", focus: [], testKey: suggestTests(ctx.type, ctx.equipment)[0].key, source: "rules" };
}

/**
 * Lässt Claude das Ziel aus dem Freitext formulieren und einen Selbsttest wählen.
 * Gesendet werden nur Ziel, Rahmen und Datum – keine Namen, keine Gesundheitsdaten.
 */
export async function summarizeGoal(ctx: GoalContext): Promise<GoalSummaryResult> {
  if (!hasAnthropicKey()) return rulesSummary(ctx);
  const candidates = suggestTests(ctx.type, ctx.equipment).map((t) => ({
    key: t.key,
    unit: t.unit,
    needs: t.needs,
  }));
  try {
    const client = new Anthropic();
    const message = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(GoalSummary) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            heute: ctx.today,
            schwerpunkte: ctx.focuses ?? [ctx.type],
            in_eigenen_worten: ctx.description,
            zusatzeinheiten_pro_woche: ctx.extraSessionsPerWeek,
            max_minuten_pro_einheit: ctx.timeBudgetMin,
            trainingsmittel: ctx.equipment,
            zieldatum: ctx.targetDate,
            angebotene_tests: candidates,
          }),
        },
      ],
    });
    const parsed = message.stop_reason === "refusal" ? null : message.parsed_output;
    if (!parsed || !(parsed.testKey in SELF_TESTS)) return rulesSummary(ctx);
    return { ...parsed, testKey: parsed.testKey as TestKey, source: "ai" };
  } catch (error) {
    console.error("[goals] KI-Zusammenfassung fehlgeschlagen", error instanceof Error ? error.message : error);
    return rulesSummary(ctx);
  }
}
