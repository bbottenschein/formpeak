import "server-only";
import { reducePrescription, type DayAllowance } from "@/core/load";
import type { LibraryExercise } from "@/features/plan/ai";
import { loadLibrary, writeExercises } from "@/features/plan/generate";
import type { PlannedExercise } from "@/features/plan/types";
import { MEASURES, type Measure } from "@/features/training/prescription";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Werkzeuge des KI-Chats (Beschreibung für das Modell). Ausführung prüft der Code. */
export const COACH_TOOLS = [
  {
    name: "replace_exercise",
    description:
      "Ersetzt eine Übung einer heutigen Einheit (z. B. Gerät belegt). Position beginnt bei 0. Gym-Übungen möglichst aus der Bibliothek (library_name exakt).",
    input_schema: {
      type: "object" as const,
      properties: {
        session_id: { type: "string" },
        position: { type: "integer" },
        name: { type: "string", description: "Kurzer deutscher Übungsname" },
        library_name: { type: ["string", "null"], description: "Exakter Name aus der Bibliothek oder null" },
        prescription: { type: "string", description: "Vorgabe, z. B. „3 × 10“, „3 × 20 s je Seite“" },
        how: { type: "string", description: "Genau ein Satz zur Ausführung" },
        measure: { type: "string", enum: [...MEASURES] },
      },
      required: ["session_id", "position", "name", "library_name", "prescription", "how", "measure"],
    },
  },
  {
    name: "reorder_exercises",
    description: "Ändert die Reihenfolge der Übungen einer heutigen Einheit. order = alle bisherigen Positionen in neuer Reihenfolge.",
    input_schema: {
      type: "object" as const,
      properties: { session_id: { type: "string" }, order: { type: "array", items: { type: "integer" } } },
      required: ["session_id", "order"],
    },
  },
  {
    name: "shorten_session",
    description: "Kürzt eine heutige Einheit auf weniger Minuten (Sätze werden anteilig reduziert). Nie verlängern.",
    input_schema: {
      type: "object" as const,
      properties: { session_id: { type: "string" }, duration_min: { type: "integer" } },
      required: ["session_id", "duration_min"],
    },
  },
  {
    name: "swap_session",
    description: "Ersetzt eine ganze Einheit durch eine Alternative im erlaubten Rahmen (Pflichtinhalte bleiben).",
    input_schema: { type: "object" as const, properties: { session_id: { type: "string" } }, required: ["session_id"] },
  },
  {
    name: "postpone_session",
    description: "„Heute keine Zeit“: verschiebt die Einheit auf den nächsten passenden Tag dieser Woche (kurze Einheiten entfallen).",
    input_schema: { type: "object" as const, properties: { session_id: { type: "string" } }, required: ["session_id"] },
  },
];

export interface ToolEnv {
  supabase: Supabase;
  userId: string;
  /** Heutige offene Vorschläge mit Übungen und Tagesrahmen. */
  sessions: Map<string, { durationMin: number; kind: string; exercises: PlannedExercise[] }>;
  allowance: DayAllowance | undefined;
  library?: LibraryExercise[];
}

/** Übung ersetzen – mit Prüfung: Unterkörper nur, wenn heute erlaubt. */
export async function replaceExercise(env: ToolEnv, input: Record<string, unknown>): Promise<string> {
  const s = env.sessions.get(String(input.session_id));
  const pos = Number(input.position);
  if (!s || !Number.isInteger(pos) || pos < 0 || pos >= s.exercises.length) return "Fehler: Einheit oder Position nicht gefunden.";
  env.library ??= await loadLibrary(env.supabase);
  const lib = input.library_name ? env.library.find((l) => l.name === input.library_name) : undefined;
  if (input.library_name && !lib) return "Fehler: library_name nicht in der Bibliothek – exakten Namen verwenden oder null.";
  if (lib?.lowerBody && env.allowance && !env.allowance.lowerBody) {
    return "Nicht erlaubt: Unterkörper-Kraft ist heute gesperrt (Spielnähe oder Ampel). Wähle eine Übung ohne Beinbelastung.";
  }
  const measure = (MEASURES as readonly string[]).includes(String(input.measure)) ? (input.measure as Measure) : "check";
  const next: PlannedExercise = {
    name: String(input.name).slice(0, 80),
    prescription: String(input.prescription ?? "").slice(0, 60),
    how: String(input.how ?? "").slice(0, 300),
    exerciseId: lib?.id ?? null,
    measure,
  };
  s.exercises = s.exercises.map((e, i) => (i === pos ? next : e));
  await writeExercises(env.supabase, env.userId, String(input.session_id), s.kind as never, s.exercises);
  return `Ersetzt: Position ${pos} ist jetzt „${next.name}“.`;
}

export async function reorderExercises(env: ToolEnv, input: Record<string, unknown>): Promise<string> {
  const s = env.sessions.get(String(input.session_id));
  const order = Array.isArray(input.order) ? input.order.map(Number) : [];
  if (!s || order.length !== s.exercises.length || new Set(order).size !== order.length || order.some((i) => !(i >= 0 && i < s.exercises.length))) {
    return "Fehler: order muss jede bisherige Position genau einmal enthalten.";
  }
  s.exercises = order.map((i) => s.exercises[i]);
  await writeExercises(env.supabase, env.userId, String(input.session_id), s.kind as never, s.exercises);
  return `Neue Reihenfolge: ${s.exercises.map((e) => e.name).join(", ")}.`;
}

export async function shortenSession(env: ToolEnv, input: Record<string, unknown>): Promise<string> {
  const id = String(input.session_id);
  const s = env.sessions.get(id);
  const minutes = Math.round(Number(input.duration_min));
  if (!s || !(minutes >= 10)) return "Fehler: Einheit nicht gefunden oder unter 10 min.";
  if (minutes >= s.durationMin) return "Nicht erlaubt: Einheiten werden nur gekürzt, nie verlängert.";
  const factor = minutes / s.durationMin;
  s.exercises = s.exercises.map((e) => ({ ...e, prescription: reducePrescription(e.prescription, factor) }));
  s.durationMin = minutes;
  await env.supabase.from("sessions").update({ duration_min: minutes }).eq("id", id).eq("user_id", env.userId);
  await writeExercises(env.supabase, env.userId, id, s.kind as never, s.exercises);
  return `Gekürzt auf ${minutes} min.`;
}
