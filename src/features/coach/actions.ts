"use server";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { mondayOf, offseasonWeek } from "@/core/load";
import { getCurrentUser } from "@/features/auth/session";
import { getGoal } from "@/features/goals/queries";
import { PLAN_MODEL } from "@/features/plan/ai";
import { getPlannedExercises } from "@/features/plan/queries";
import { postponeSession, swapSession } from "@/features/plan/session-actions";
import { loadWeekContext } from "@/features/plan/week-context";
import { isOpenSuggestion, loadSessions } from "@/features/sessions/data";
import { computeMetricsFor } from "@/features/today/metrics";
import { hasAnthropicKey } from "@/lib/env.server";
import { userToday } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import { COACH_TOOLS, replaceExercise, reorderExercises, shortenSession, type ToolEnv } from "./tools";

const History = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
  .min(1)
  .max(30);
export type ChatMessage = z.infer<typeof History>[number];

const SYSTEM = `Du bist der Trainer-Assistent der App FormPeak für ambitionierte Amateurfußballer. Du hilfst beim heutigen Training und beantwortest Fragen zu Training, Plan und App.

So arbeitest du:
- Antworte kurz (1–3 Sätze), auf Deutsch, in der Du-Form, ohne Emojis.
- Wenn der Nutzer etwas am heutigen Training ändern will (Gerät belegt, keine Zeit, lieber etwas anderes, Reihenfolge), ändere es direkt mit einem Werkzeug und sag danach in einem Satz, was du geändert hast.
- Ersatzübungen: gleicher Zweck und gleiche Muskelgruppe, vergleichbare Vorgabe; Gym-Übungen aus der Bibliothek (library_name exakt). Achte auf "erlaubt" (z. B. Unterkörper gesperrt).
- Ob belastet werden darf, entscheiden die Regeln der App (Ampel, Spieltag, Wochenlast). Überstimme sie nie und versuche nicht, Einheiten zu verlängern oder intensiver zu machen.
- Keine Diagnosen, keine Ernährungs- oder Therapiepläne. Bei Schmerzen: nicht weitertrainieren, was weh tut; bei anhaltenden oder starken Schmerzen ärztlich oder physiotherapeutisch abklären lassen.
- Erfinde keine Studien. Wenn du etwas nicht weißt, sag es.`;

/** KI-Chat: antwortet und ändert bei Bedarf das heutige Training (Werkzeuge, geprüft im Code). */
export async function chatCoach(history: ChatMessage[]): Promise<{ reply: string; changed: boolean }> {
  const parsed = History.safeParse(history);
  if (!parsed.success || !hasAnthropicKey()) return { reply: "", changed: false };
  const user = await getCurrentUser();
  const today = userToday(user.timezone);
  const supabase = await createClient();
  const [goal, metrics, rows] = await Promise.all([
    getGoal(user.id),
    computeMetricsFor(user.id, today, today),
    loadSessions(supabase, user.id, today, today),
  ]);
  const plan = rows.filter(isOpenSuggestion);
  const exercises = await getPlannedExercises(plan.map((r) => r.id));
  const wc = await loadWeekContext(supabase, user.id, today, today, goal, metrics.light);
  const allowance = wc?.allowances.find((a) => a.date === today);

  const env: ToolEnv = {
    supabase,
    userId: user.id,
    allowance,
    sessions: new Map(plan.map((r) => [r.id, { durationMin: r.duration_min, kind: r.type, exercises: exercises[r.id] ?? [] }])),
  };
  const context = {
    heute: today,
    ampel: metrics.light,
    readiness: metrics.readiness,
    schmerz: metrics.painSpots.filter((s) => s.level !== "note").map((s) => ({ region: s.region, seite: s.side, stufe: s.level })),
    ziel: goal.goal ? { schwerpunkte: goal.goal.focuses, beschreibung: goal.goal.aiSummary || goal.goal.description } : null,
    off_season: wc?.offWeek ? { abschnitt: wc.offWeek.block, entlastungswoche: wc.offWeek.deload } : null,
    erlaubt_heute: allowance
      ? { arten: allowance.kinds, max_minuten: allowance.maxMinutes, max_rpe: allowance.maxRpe, unterkoerper: allowance.lowerBody }
      : null,
    termine_heute: rows
      .filter((r) => r.status !== "cancelled")
      .map((r) => ({ art: r.type, titel: r.title, uhrzeit: r.start_time?.slice(0, 5) ?? null, status: r.status })),
    einheiten_heute: plan.map((r) => ({
      session_id: r.id,
      titel: r.title,
      art: r.type,
      dauer_min: r.duration_min,
      uebungen: (exercises[r.id] ?? []).map((e, position) => ({ position, name: e.name, vorgabe: e.prescription, eingabe: e.measure })),
    })),
    trainingsmittel: wc?.frame.equipment ?? [],
    woche_ab: mondayOf(today),
    off_season_woche: wc?.off ? offseasonWeek(wc.off.phase, today).week : null,
  };

  const client = new Anthropic();
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = parsed.data.map((m, i) =>
    i === 0 && m.role === "user"
      ? { role: "user", content: `Kontext (JSON, nicht vorlesen): ${JSON.stringify(context)}\n\n${m.content}` }
      : { role: m.role, content: m.content },
  );
  if (messages[0].role !== "user") return { reply: "", changed: false };
  // Kontext immer an die erste Nutzernachricht der aktuellen Sitzung hängen.
  let changed = false;

  for (let round = 0; round < 5; round++) {
    const res = await client.beta.messages.create({
      model: PLAN_MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      tools: COACH_TOOLS,
      messages,
    });
    const uses = res.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
    if (uses.length === 0 || res.stop_reason !== "tool_use") {
      const text = res.content
        .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: text, changed };
    }
    messages.push({ role: "assistant", content: res.content as Anthropic.Beta.Messages.BetaContentBlockParam[] });
    const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      const input = (u.input ?? {}) as Record<string, unknown>;
      const id = String(input.session_id ?? "");
      let out: string;
      if (!env.sessions.has(id)) out = "Fehler: Nur heutige, offene Vorschläge können geändert werden.";
      else if (u.name === "replace_exercise") out = await replaceExercise(env, input);
      else if (u.name === "reorder_exercises") out = await reorderExercises(env, input);
      else if (u.name === "shorten_session") out = await shortenSession(env, input);
      else if (u.name === "swap_session") out = (await swapSession(id)).ok ? "Einheit ersetzt." : "Keine passende Alternative im erlaubten Rahmen.";
      else if (u.name === "postpone_session") {
        const r = await postponeSession(id);
        out = r.movedTo ? `Verschoben auf ${r.movedTo}.` : r.dropped ? "Kurze Einheit entfällt heute." : "Kein passender Tag diese Woche.";
      } else out = "Unbekanntes Werkzeug.";
      if (!out.startsWith("Fehler") && !out.startsWith("Nicht") && !out.startsWith("Kein") && !out.startsWith("Unbekannt")) changed = true;
      results.push({ type: "tool_result", tool_use_id: u.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "", changed };
}
