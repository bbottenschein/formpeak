import { getCurrentUser } from "@/features/auth/session";
import { userToday } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

// Alle Tabellen mit Nutzerdaten. Gelesen wird mit dem Nutzer-Token, RLS liefert nur eigene Zeilen.
const TABLES = [
  "consents",
  "season_phases",
  "fixture_series",
  "sessions",
  "checkins",
  "pain_entries",
  "session_exercises",
  "exercise_sets",
  "daily_metrics",
  "goals",
  "goal_tests",
] as const;

/** Datenexport (DSGVO Art. 20) als JSON-Datei. */
export async function GET() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone, locale, morning_reminder, evening_reminder, available_weekdays, time_budget_min, equipment, extra_sessions_per_week, created_at")
    .eq("id", user.id)
    .single();
  const { data: customExercises } = await supabase.from("exercises").select("*").eq("user_id", user.id);

  const data: Record<string, unknown> = { exported_at: new Date().toISOString(), profile, custom_exercises: customExercises };
  for (const table of TABLES) {
    const { data: rows, error } = await supabase.from(table).select("*").eq("user_id", user.id);
    data[table] = error ? { error: error.message } : rows;
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="formpeak-export-${userToday(user.timezone)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
