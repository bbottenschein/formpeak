import "server-only";
import { inOffseason, type ExpectedIntensity, type GymFocus, type Session, type SessionStatus, type SessionType } from "@/core/load";
import { missingFixtures, type FixtureSeries } from "@/features/calendar/series";
import { breakPhases } from "@/features/offseason/queries";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const SESSION_COLUMNS =
  "id, date, start_time, type, status, series_id, is_fixture, expected_intensity, gym_focus, duration_min, target_rpe, default_rpe, rpe, fatigue, match_minutes, planned_by, rationale, against_recommendation, notes, title, adjustment, adjusted_on, basis, focus";

export interface SessionRow {
  id: string;
  date: string;
  start_time: string | null;
  type: SessionType;
  status: SessionStatus;
  series_id: string | null;
  is_fixture: boolean;
  expected_intensity: ExpectedIntensity | null;
  gym_focus: GymFocus | null;
  duration_min: number;
  target_rpe: number | null;
  default_rpe: number;
  rpe: number | null;
  fatigue: number | null;
  match_minutes: number | null;
  planned_by: "user" | "rules" | "ai";
  rationale: string | null;
  against_recommendation: boolean;
  notes: string | null;
  /** Titel einer vorgeschlagenen Einheit (Wochenplan), sonst null. */
  title: string | null;
  /** Warum die Einheit heute nach dem Check-in angepasst wurde (tägliche Anpassung). */
  adjustment: "light_red" | "light_yellow" | "pain" | "rules" | null;
  adjusted_on: string | null;
  /** Wissenschaftliche Grundlage einer vorgeschlagenen Einheit (Schlüssel aus plan/basis.ts). */
  basis: string[];
  /** Inhalte einer vorgeschlagenen Einheit (z. B. sprint, prevention). */
  focus: string[];
}

export function toCoreSession(s: SessionRow): Session {
  return {
    id: s.id,
    date: s.date,
    type: s.type,
    status: s.status,
    durationMin: s.duration_min,
    rpe: s.rpe,
    targetRpe: s.target_rpe,
    defaultRpe: s.default_rpe,
    isFixture: s.is_fixture,
    expectedIntensity: s.expected_intensity,
    gymFocus: s.gym_focus,
  };
}

export const SERIES_COLUMNS =
  "id, kind, title, weekdays, start_time, duration_min, expected_intensity, default_rpe, valid_from, valid_until";

export interface SeriesRow {
  id: string;
  kind: "training" | "match";
  title: string;
  weekdays: number[];
  start_time: string | null;
  duration_min: number;
  expected_intensity: ExpectedIntensity;
  default_rpe: number;
  valid_from: string;
  valid_until: string | null;
}

export function toSeries(r: SeriesRow): FixtureSeries {
  return {
    id: r.id,
    kind: r.kind,
    weekdays: r.weekdays,
    startTime: r.start_time ? r.start_time.slice(0, 5) : null,
    durationMin: r.duration_min,
    expectedIntensity: r.expected_intensity,
    defaultRpe: r.default_rpe,
    validFrom: r.valid_from,
    validUntil: r.valid_until,
  };
}

/**
 * Legt die Einheiten aller Serien im Zeitraum an, die noch fehlen. Idempotent:
 * Verschobene und abgesagte Termine behalten ihr `series_date` und werden nicht neu angelegt.
 */
export async function ensureFixtures(supabase: Supabase, userId: string, from: string, to: string) {
  const { data: series } = await supabase
    .from("fixture_series")
    .select(SERIES_COLUMNS)
    .eq("user_id", userId)
    .lte("valid_from", to);
  if (!series?.length) return;

  const { data: existing } = await supabase
    .from("sessions")
    .select("series_id, series_date")
    .eq("user_id", userId)
    .not("series_id", "is", null)
    .gte("series_date", from)
    .lte("series_date", to);
  const keys = new Set((existing ?? []).map((s) => `${s.series_id}|${s.series_date}`));

  // In der Off-Season (Pause) entstehen keine Trainings und Spiele aus Serien.
  const breaks = await breakPhases(supabase, userId, from, to);
  const rows = missingFixtures((series as SeriesRow[]).map(toSeries), keys, from, to).filter(
    (r) => !breaks.some((b) => inOffseason(b, r.date)),
  );
  if (!rows.length) return;
  const { error } = await supabase
    .from("sessions")
    .upsert(
      rows.map((r) => ({ ...r, user_id: userId })),
      { onConflict: "user_id,series_id,series_date", ignoreDuplicates: true },
    );
  if (error) console.error("[calendar] Termine nicht angelegt", error.message);
}

/** Einheiten im Zeitraum, sortiert nach Datum und Uhrzeit. */
export async function loadSessions(
  supabase: Supabase,
  userId: string,
  from: string,
  to: string,
): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("start_time", { nullsFirst: false });
  if (error) throw new Error(`Einheiten nicht lesbar: ${error.message}`);
  return (data ?? []) as SessionRow[];
}

/** Abschlusstest eines Ziels (fest eingeplant, wird nie umgeplant oder angepasst). */
export const isGoalTestSession = (r: Pick<SessionRow, "rationale">) => Boolean(r.rationale?.startsWith("goal_test:"));

/** Offener Vorschlag der App (KI oder Regeln), der umgeplant, verschoben oder angepasst werden darf. */
export const isOpenSuggestion = (r: Pick<SessionRow, "planned_by" | "status" | "rationale">) =>
  (r.planned_by === "ai" || r.planned_by === "rules") && r.status === "planned" && !isGoalTestSession(r);
