import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { PLAN_KINDS, type PlanViolation } from "@/core/load";

export const PLAN_MODEL = "claude-opus-5-5";
export const PROMPT_VERSION = "week-v1";

/** Bibliothek für Gym-Übungen (Name → Unterkörper), damit die Regeln greifen können. */
export interface LibraryExercise {
  id: string;
  name: string;
  equipment: string;
  lowerBody: boolean;
}

function schema(library: LibraryExercise[]) {
  const names = library.map((e) => e.name) as [string, ...string[]];
  const Exercise = z.object({
    name: z.string().describe("Kurzer deutscher Übungsname, wie ein Trainer ihn sagt"),
    libraryName: z
      .enum(names)
      .nullable()
      .describe("Exakter Name aus der Gym-Bibliothek, wenn die Übung dort steht, sonst null"),
    prescription: z.string().describe("Vorgabe kurz, z. B. „3 × 8, 40 kg“, „4 × 4 min“, „60 s je Seite“"),
    how: z.string().describe("Genau ein kurzer Satz in Du-Form: wie die Übung richtig ausgeführt wird"),
  });
  const Unit = z.object({
    date: z.string().describe("Datum YYYY-MM-DD aus der Woche"),
    kind: z.enum(PLAN_KINDS),
    title: z.string().describe("Kurzer Titel, höchstens 40 Zeichen, z. B. „Kraft Unterkörper“"),
    durationMin: z.number().describe("Dauer in Minuten"),
    targetRpe: z.number().describe("Ziel-Anstrengung als ganze Zahl 1–10 (RPE)"),
    gymFocus: z.enum(["lower", "upper", "full"]).nullable().describe("Nur bei kind=gym, sonst null"),
    reason: z.string().describe("Ein Satz, warum diese Einheit an diesem Tag sinnvoll ist"),
    exercises: z.array(Exercise).describe("3–7 Übungen in Reihenfolge, inkl. kurzem Aufwärmen"),
  });
  return z.object({
    focus: z.string().describe("Wochenfokus in einem Satz, Du-Form"),
    sessions: z.array(Unit),
  });
}

export type AiWeekPlan = z.infer<ReturnType<typeof schema>>;

const SYSTEM = `Du bist Athletiktrainer für ambitionierte Amateurfußballer. Du planst die Zusatzeinheiten einer Woche rund um das feste Teamtraining und die Spiele.

Harte Regeln (der Code prüft sie und streicht Verstöße):
- Plane nur an Tagen, deren "erlaubt.arten" nicht leer ist, nur mit diesen Arten, höchstens "max_minuten" und "max_rpe".
- Haupteinheiten (gym, run_intervals oder RPE über 4) nur an Tagen mit "haupteinheit": true und insgesamt höchstens "haupteinheiten_pro_woche".
- Unterkörper-Kraftübungen aus der Bibliothek (unterkoerper: true) nur an Tagen mit "unterkoerper": true.
- Höchstens 2 Einheiten pro Tag. Mindestens ein Tag der Woche bleibt ganz frei.
- Die Last der Haupteinheiten (Dauer × RPE) bleibt unter "wochenlast_budget_au", falls angegeben.
- Spare schmerzende Regionen aus "schmerz_sperren" aus. Bei Schmerz nie zum Weitertrainieren raten.
- Nutze nur die angegebenen Trainingsmittel.

So planst du:
- Haupteinheiten passend zum Ziel, an freien Tagen ohne Fußball kurze Mobilität (10–15 min), am Tag vor dem Spiel kurz aktivieren, am Tag nach dem Spiel Regeneration.
- Gym: Übungen aus der Bibliothek ("libraryName" exakt setzen). Gewichte aus dem Gym-Verlauf ableiten (leicht steigern, wenn die letzte Einheit sauber war); ohne Verlauf Wiederholungen und "moderates Gewicht" angeben.
- Jede Übung hat eine kurze Vorgabe und genau einen Satz Erklärung zur Ausführung.
- Antworte auf Deutsch, in der Du-Form, sachlich und ohne Emojis. Keine Diagnosen, keine Ernährungs- oder Therapieempfehlungen.`;

function violationText(v: PlanViolation, plan: AiWeekPlan): string {
  const s = "index" in v ? plan.sessions[v.index] : null;
  const where = s ? `Einheit ${s.date} „${s.title}“: ` : "";
  switch (v.code) {
    case "outside_week":
      return `${where}Datum liegt nicht in der planbaren Woche.`;
    case "kind_not_allowed":
      return `${where}Diese Art bzw. eine Haupteinheit ist an diesem Tag nicht erlaubt.`;
    case "too_long":
      return `${where}zu lang, höchstens ${v.max} min.`;
    case "rpe_too_high":
      return `${where}zu intensiv, höchstens RPE ${v.max}.`;
    case "lower_body_blocked":
      return `${where}Unterkörper-Kraftübungen sind an diesem Tag gesperrt (Spielnähe).`;
    case "too_many_main":
      return `${where}mehr Haupteinheiten als gewünscht (höchstens ${v.max}).`;
    case "too_many_per_day":
      return `${where}mehr als ${v.max} Einheiten an einem Tag.`;
    case "no_rest_day":
      return "Kein Tag der Woche bleibt frei – lass mindestens einen Tag ganz ohne Einheit.";
    case "weekly_load_increase":
      return `Wochenlast steigt um ${v.percent} %, erlaubt sind ${v.maxPercent} %. Weniger oder kürzere Haupteinheiten.`;
  }
}

/**
 * Lässt Claude die Woche planen. Bei Verstößen gegen die Leitplanken gibt es genau eine Rückfrage
 * mit den Fehlern; was danach noch verstößt, korrigiert der Code (enforcePlan).
 * Der Kontext enthält keine Namen.
 */
export async function aiWeekPlan(
  context: unknown,
  library: LibraryExercise[],
  check: (plan: AiWeekPlan) => PlanViolation[],
): Promise<{ plan: AiWeekPlan; violations: PlanViolation[]; attempts: number } | null> {
  const client = new Anthropic();
  const format = betaZodOutputFormat(schema(library));
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: JSON.stringify(context) }];

  let last: { plan: AiWeekPlan; violations: PlanViolation[]; attempts: number } | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const message = await client.beta.messages.parse({
      model: PLAN_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format },
      system: SYSTEM,
      messages,
    });
    const plan = message.stop_reason === "refusal" ? null : message.parsed_output;
    if (!plan) return last;
    const violations = check(plan);
    last = { plan, violations, attempts: attempt };
    if (violations.length === 0) break;
    messages.push(
      { role: "assistant", content: JSON.stringify(plan) },
      {
        role: "user",
        content: `Der Plan verletzt diese Regeln. Korrigiere ihn und gib den vollständigen Plan neu aus:\n- ${violations
          .map((v) => violationText(v, plan))
          .join("\n- ")}`,
      },
    );
  }
  return last;
}
