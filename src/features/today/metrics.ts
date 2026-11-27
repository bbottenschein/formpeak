import "server-only";
import {
  addDays,
  computeDailyMetrics,
  computeTrend,
  type DailyInput,
  type DailyMetrics,
  type MorningCheckin,
  type PainEntry,
  type TrendPoint,
} from "@/core/load";
import { ensureFixtures, loadSessions, toCoreSession } from "@/features/sessions/data";
import { createClient } from "@/lib/supabase/server";

/** So weit zurück werden Daten für ACWR (28 Tage), EWMA und Schmerzserien geladen. */
const LOOKBACK_DAYS = 90;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function firstDataDate(supabase: Supabase, userId: string): Promise<string | null> {
  const [checkin, session] = await Promise.all([
    supabase.from("checkins").select("date").eq("user_id", userId).order("date").limit(1).maybeSingle(),
    supabase.from("sessions").select("date").eq("user_id", userId).order("date").limit(1).maybeSingle(),
  ]);
  const dates = [checkin.data?.date, session.data?.date].filter((d): d is string => Boolean(d));
  return dates.length ? dates.sort()[0] : null;
}

/** Lädt alles, was die Belastungslogik bis zu einem Tag braucht. */
async function loadDailyInput(userId: string, date: string, today: string): Promise<DailyInput> {
  const supabase = await createClient();
  const from = addDays(date, -LOOKBACK_DAYS);

  // Feste Termine müssen als Einheit existieren, damit vergangene Termine in die Last eingehen.
  await ensureFixtures(supabase, userId, from, addDays(date, 14));

  const [sessions, checkins, pains, first, evenings] = await Promise.all([
    loadSessions(supabase, userId, from, date),
    supabase
      .from("checkins")
      .select("date, sleep_hours, sleep_quality, energy, soreness, stress, resting_hr")
      .eq("user_id", userId)
      .eq("kind", "morning")
      .gte("date", from)
      .lte("date", date),
    supabase
      .from("pain_entries")
      .select("date, region, side, intensity, kind, swollen")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", date),
    firstDataDate(supabase, userId),
    supabase
      .from("checkins")
      .select("date, evening_stress")
      .eq("user_id", userId)
      .eq("kind", "evening")
      .gte("date", from)
      .lte("date", date),
  ]);
  for (const r of [checkins, pains]) {
    if (r.error) throw new Error(`Daten für Kennzahlen nicht lesbar: ${r.error.message}`);
  }

  return {
    sessions: sessions.map(toCoreSession),
    morningCheckins: (checkins.data ?? []).map(
      (c): MorningCheckin => ({
        date: c.date,
        sleepHours: Number(c.sleep_hours),
        sleepQuality: c.sleep_quality,
        energy: c.energy,
        soreness: c.soreness,
        stress: c.stress,
        restingHr: c.resting_hr,
      }),
    ),
    painEntries: (pains.data ?? []) as PainEntry[],
    firstDataDate: first,
    today,
    eveningStress: (evenings.data ?? [])
      .filter((e) => e.evening_stress != null)
      .map((e) => ({ date: e.date, stress: e.evening_stress as number })),
  };
}

/** Kennzahlen eines Tages. */
export async function computeMetricsFor(userId: string, date: string, today: string): Promise<DailyMetrics> {
  return computeDailyMetrics(date, await loadDailyInput(userId, date, today));
}

/** Kennzahlen für heute plus Verlauf der letzten `days` Tage (inkl. heute), mit einem Datenabruf. */
export async function computeTodayWithTrend(
  userId: string,
  today: string,
  days = 28,
): Promise<{ metrics: DailyMetrics; trend: TrendPoint[] }> {
  const input = await loadDailyInput(userId, today, today);
  return {
    metrics: computeDailyMetrics(today, input),
    trend: computeTrend(addDays(today, -(days - 1)), today, input),
  };
}

/** Berechnet die Kennzahlen eines Tages neu und speichert sie in `daily_metrics`. */
export async function recomputeDailyMetrics(
  userId: string,
  date: string,
  today: string,
): Promise<DailyMetrics> {
  const m = await computeMetricsFor(userId, date, today);
  const supabase = await createClient();
  const { error } = await supabase.from("daily_metrics").upsert({
    user_id: userId,
    date,
    day_load: Math.round(m.dayLoad),
    acute_load: Math.round(m.acute),
    chronic_load: m.chronic,
    acwr: m.acwr,
    ewma_ratio: m.ewmaRatio,
    calibration_days_left: m.calibrationDaysLeft,
    readiness: m.readiness,
    light: m.light,
    reasons: m.reasons,
    pain_spots: m.painSpots,
    computed_at: new Date().toISOString(),
  });
  if (error) console.error("[metrics] daily_metrics nicht gespeichert", error.message);
  return m;
}
