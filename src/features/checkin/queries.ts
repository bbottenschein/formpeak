import "server-only";
import { addDays } from "@/core/load";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_EVENING, EMPTY_MORNING, type EveningCheckinInput, type MorningCheckinInput } from "./schema";

export interface MorningFormData {
  values: MorningCheckinInput;
  /** true = heute existiert schon ein Check-in (Bearbeiten). */
  existing: boolean;
}

/**
 * Vorbelegung des Morgen-Check-ins: heutiger Check-in (Bearbeiten), sonst der letzte
 * Check-in (Werte vom Vortag, aber ohne Ruhepuls und mit dessen Schmerzstellen).
 */
export async function getMorningFormData(userId: string, today: string): Promise<MorningFormData> {
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("checkins")
    .select("id, date, sleep_hours, sleep_quality, energy, soreness, stress, resting_hr")
    .eq("user_id", userId)
    .eq("kind", "morning")
    .lte("date", today)
    .gte("date", addDays(today, -14))
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return { values: EMPTY_MORNING, existing: false };

  const existing = latest.date === today;
  const { data: pains } = await supabase
    .from("pain_entries")
    .select("region, side, intensity, kind, swollen")
    .eq("checkin_id", latest.id);

  return {
    existing,
    values: {
      sleepHours: Number(latest.sleep_hours),
      sleepQuality: latest.sleep_quality,
      energy: latest.energy,
      soreness: latest.soreness,
      stress: latest.stress,
      // Der Puls wird jeden Tag neu gemessen – nur beim Bearbeiten vorbelegen.
      restingHr: existing ? latest.resting_hr : null,
      pains: (pains ?? []).filter((p) => p.intensity > 0) as MorningCheckinInput["pains"],
    },
  };
}

/** Heutiger Abend-Check-in zum Bearbeiten, sonst Standardwerte. */
export async function getEveningFormData(
  userId: string,
  today: string,
): Promise<{ values: EveningCheckinInput; existing: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("checkins")
    .select("daily_load, evening_stress, evening_energy, steps, note")
    .eq("user_id", userId)
    .eq("kind", "evening")
    .eq("date", today)
    .maybeSingle();
  if (!data) return { values: EMPTY_EVENING, existing: false };
  return {
    existing: true,
    values: {
      dailyLoad: data.daily_load,
      stress: data.evening_stress,
      energy: data.evening_energy,
      steps: data.steps,
      note: data.note,
    },
  };
}

/** Welche Check-ins es heute schon gibt. */
export async function getCheckinStatus(userId: string, today: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("checkins").select("kind").eq("user_id", userId).eq("date", today);
  const kinds = new Set((data ?? []).map((c) => c.kind));
  return { morning: kinds.has("morning"), evening: kinds.has("evening") };
}
