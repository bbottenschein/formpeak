import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { PLAN_FOCUS, PLAN_KINDS, type PlanViolation } from "@/core/load";
import { MEASURES } from "@/features/training/prescription";
import { BASIS_KEYS } from "./basis";

export const PLAN_MODEL = "claude-opus-5-5";
export const PROMPT_VERSION = "week-v2";

/** Bibliothek für Gym-Übungen (Name → Unterkörper), damit die Regeln greifen können. */
export interface LibraryExercise {
  id: string;
  name: string;
  equipment: string;
  lowerBody: boolean;
}

function unitSchema(library: LibraryExercise[]) {
  const names = library.map((e) => e.name) as [string, ...string[]];
  const Exercise = z.object({
    name: z.string().describe("Kurzer deutscher Übungsname, wie ein Trainer ihn sagt"),
    libraryName: z
      .enum(names)
      .nullable()
      .describe("Exakter Name aus der Gym-Bibliothek, wenn die Übung dort steht, sonst null"),
    prescription: z.string().describe("Vorgabe kurz, z. B. „3 × 8, 40 kg“, „4 × 4 min“, „60 s je Seite“"),
    how: z.string().describe("Genau ein kurzer Satz in Du-Form: wie die Übung richtig ausgeführt wird"),
    measure: z
      .enum(MEASURES)
      .describe("Eingabe pro Satz: weight_reps (Gewicht × Wdh), reps (Körpergewicht), time (Halten/Dauer in s), check (Sprints, Strecken, Dehnungen)"),
  });
  const Unit = z.object({
    date: z.string().describe("Datum YYYY-MM-DD aus der Woche"),
    kind: z.enum(PLAN_KINDS),
    title: z.string().describe("Kurzer Titel, höchstens 40 Zeichen, z. B. „Kraft Unterkörper“"),
    durationMin: z.number().describe("Dauer in Minuten"),
    targetRpe: z.number().describe("Ziel-Anstrengung als ganze Zahl 1–10 (RPE)"),
    gymFocus: z.enum(["lower", "upper", "full"]).nullable().describe("Nur bei kind=gym, sonst null"),
    reason: z.string().describe("Ein Satz, warum diese Einheit an diesem Tag sinnvoll ist"),
    focus: z.array(z.enum(PLAN_FOCUS)).describe("Inhalte der Einheit, z. B. strength, sprint, prevention"),
    basis: z
      .array(z.enum(BASIS_KEYS))
      .describe("1–2 Schlüssel der wissenschaftlichen Grundlage aus der Liste, auf die sich die Einheit stützt"),
    exercises: z.array(Exercise).describe("3–7 Übungen in Reihenfolge, inkl. kurzem Aufwärmen"),
  });
  return Unit;
}

function schema(library: LibraryExercise[]) {
  const Unit = unitSchema(library);
  return z.object({
    focus: z.string().describe("Wochenfokus in einem Satz, Du-Form"),
    sessions: z.array(Unit),
  });
}

export type AiWeekPlan = z.infer<ReturnType<typeof schema>>;

const SYSTEM = `Du bist Athletiktrainer für ambitionierte Amateurfußballer und planst evidenzbasiert. Du planst die Zusatzeinheiten einer Woche – in der Saison rund um Teamtraining und Spiele, in der Off-Season (Pause ohne Teamtraining und Spiele) als Hauptprogramm.

Harte Regeln (der Code prüft sie, fragt einmal nach und streicht danach Verstöße):
- Plane nur an Tagen, deren "erlaubt.arten" nicht leer ist, nur mit diesen Arten, höchstens "max_minuten" und "max_rpe".
- Haupteinheiten (gym, run_intervals oder RPE über 4) nur an Tagen mit "haupteinheit": true und insgesamt höchstens "haupteinheiten_pro_woche".
- Unterkörper-Kraftübungen aus der Bibliothek (unterkoerper: true) nur an Tagen mit "unterkoerper": true.
- Höchstens 2 Einheiten pro Tag. Mindestens "ruhetage" Tage der Woche bleiben ganz frei.
- Die Last der Haupteinheiten (Dauer × RPE) bleibt unter "wochenlast_budget_au", falls angegeben.
- "pflichtinhalte" müssen in mindestens einer Einheit vorkommen und im Feld "focus" stehen.
- Spare schmerzende Regionen aus "schmerz_sperren" aus. Bei Schmerz nie zum Weitertrainieren raten.
- Nutze nur die angegebenen Trainingsmittel.

Trainingswissenschaftliche Grundsätze (halte dich daran, erfinde keine Studien; begründe nur über die Schlüssel in "basis"):
- Kraft: Grundübungen (Kniebeuge, Kreuzheben-Varianten, Ausfallschritte, Hip Thrust, Zug/Druck Oberkörper). Kraftaufbau 3–5 × 3–6 Wdh mit 2–3 min Pause; Muskelaufbau 3–4 × 6–12 Wdh, 1–3 Wiederholungen vor dem Muskelversagen. Unterkörper schwer höchstens 2–3 × pro Woche, mindestens 48 h dazwischen.
- Ausdauer: harte Intervalle (z. B. 4 × 4 min bei 90–95 % HFmax mit 3 min locker, oder 15 s/15 s) höchstens 2 × pro Woche, dazu lockere Läufe (Unterhaltungstempo). Nicht am Tag nach schwerem Beintraining hart laufen.
- Sprint: maximale Sprints über 10–30 m, 4–8 Wiederholungen, volle Pause (mindestens 1 min pro 10 m), frisch und nach gutem Aufwärmen; nicht nach harter Ermüdung.
- Prävention: Nordic Hamstring Curls (z. B. 2–3 × 5–8) und Copenhagen Plank 1–2 × pro Woche, gerne am Ende einer Kraft-Einheit.
- Reihenfolge innerhalb einer Einheit: Aufwärmen → Sprint/Sprung → Kraft → Ausdauer bzw. Prävention.
- Progression: von Woche zu Woche nur moderat steigern (Wiederholungen, Gewicht oder Umfang – nicht alles gleichzeitig).
- Gym-Gewichte aus "gym_verlauf" ableiten (2,5–5 % mehr, wenn die letzte Einheit sauber war); ohne Verlauf "RIR 2" (zwei Wiederholungen Reserve) statt kg angeben.

Off-Season ("off_season" ist gesetzt):
- Abschnitt "recover" (Erholen): nur locker – Radfahren, lockeres Laufen, Mobilität, leichte Ganzkörperkraft; keine Pflichtinhalte, RPE höchstens 4.
- Abschnitt "build" (Aufbauen): Schwerpunkt Kraft (2–3 ×) und Ausdauer (Grundlage + 1–2 × Intervalle), dazu jede Woche Sprints und Prävention. In der Entlastungswoche ("entlastungswoche": true) Umfang um etwa 30–40 % senken, Intensität halten.
- Abschnitt "return" (Zurück zum Fußball): fußballspezifisch – wiederholte Sprints, Richtungswechsel, harte Intervalle, Kraft erhalten (weniger Sätze, schwer). Die Wochenlast nähert sich "saison_wochenlast_au", damit der Start der Vorbereitung keine Lastspitze ist.
- Ziel des Spielers einbeziehen, aber Sprint und Prävention nie weglassen (außer im Abschnitt "recover").

Form:
- Jede Übung hat eine kurze Vorgabe und genau einen Satz zur Ausführung. "reason": ein Satz, warum diese Einheit an diesem Tag – ohne Quellen.
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
    case "too_few_rest_days":
      return `Zu wenige Ruhetage – lass mindestens ${v.min} Tage ganz ohne Einheit.`;
    case "missing_focus":
      return v.focus === "sprint"
        ? "Es fehlen Sprints – plane in einer Einheit maximale Sprints (focus: sprint)."
        : "Es fehlt Prävention – plane Nordic Curls/Copenhagen Plank in einer Einheit (focus: prevention).";
    case "deload_too_high":
      return `Entlastungswoche: Die Wochenlast darf höchstens ${v.maxPercent} % der Vergleichswoche betragen – Umfang senken, Intensität halten.`;
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

export type AiUnit = z.infer<ReturnType<typeof unitSchema>>;

const ADJUST_SYSTEM = `Du bist Athletiktrainer für Amateurfußballer. Der Spieler hat heute Schmerzen angegeben. Passe die geplante Einheit so an, dass die schmerzenden Regionen nicht belastet werden.

Regeln:
- Gleiches Datum, gleiche Art ("kind"), Dauer höchstens "max_minuten", RPE höchstens "max_rpe".
- Ersetze oder streiche Übungen, die die schmerzenden Regionen belasten. Unterkörper-Kraftübungen nur, wenn "unterkoerper": true und die Region nicht betroffen ist.
- "reason": ein Satz, was du wegen der Schmerzen geändert hast. Rate nie zum Weitertrainieren trotz Schmerz; bei anhaltenden Schmerzen auf ärztliche oder physiotherapeutische Abklärung verweisen.
- Jede Übung mit kurzer Vorgabe und genau einem Satz zur Ausführung. Deutsch, Du-Form, ohne Emojis, keine Diagnosen.`;

/** Formuliert eine heutige Einheit um, damit schmerzende Regionen ausgespart werden. */
export async function aiSpareUnit(context: unknown, library: LibraryExercise[]): Promise<AiUnit | null> {
  const client = new Anthropic();
  const message = await client.beta.messages.parse({
    model: PLAN_MODEL,
    max_tokens: 6000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(unitSchema(library)) },
    system: ADJUST_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(context) }],
  });
  return message.stop_reason === "refusal" ? null : message.parsed_output;
}

const ALT_SYSTEM = `Du bist Athletiktrainer für Amateurfußballer. Der Spieler möchte statt der geplanten Einheit heute etwas anderes machen. Schlage genau eine Alternative vor.

Regeln:
- Gleiches Datum. Nur Arten aus "erlaubt.arten", höchstens "max_minuten" und "max_rpe"; Haupteinheiten (gym, run_intervals oder RPE über 4) nur, wenn "haupteinheit": true.
- Unterkörper-Kraftübungen (Bibliothek, unterkoerper: true) nur, wenn "unterkoerper": true.
- Inhalte aus "behalten" (z. B. sprint, prevention) müssen in der Alternative vorkommen und in "focus" stehen.
- Deutlich andere Übungen als bisher, ähnlicher Trainingszweck (Ziel, Abschnitt der Off-Season beachten).
- Nur die angegebenen Trainingsmittel. Schmerzende Regionen aussparen.
- Begründe nur über Schlüssel aus "grundlagen" (Feld "basis"), erfinde keine Studien.
- Jede Übung: kurze Vorgabe und genau ein Satz zur Ausführung. Deutsch, Du-Form, ohne Emojis, keine Diagnosen.`;

/** „Lieber etwas anderes“: eine Alternative im gleichen Tagesrahmen. */
export async function aiAlternative(context: unknown, library: LibraryExercise[]): Promise<AiUnit | null> {
  const client = new Anthropic();
  const message = await client.beta.messages.parse({
    model: PLAN_MODEL,
    max_tokens: 6000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(unitSchema(library)) },
    system: ALT_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(context) }],
  });
  return message.stop_reason === "refusal" ? null : message.parsed_output;
}
