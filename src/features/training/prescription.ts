/**
 * Liest aus einer Vorgabe wie „4 × 5, 60 kg“, „3 × 8 je Seite“ oder „60 s je Seite“ die Zahl der
 * Sätze, Wiederholungen und eine Zeit für den Timer. Unbekanntes Format → null.
 */
export interface ParsedPrescription {
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  /** Dauer für den Timer in Sekunden (pro Satz bzw. gesamt). */
  seconds: number | null;
}

export function parsePrescription(text: string): ParsedPrescription {
  const setsMatch = text.match(/^\s*(\d+)\s*[×x]\s*(\d+)(?!\d)(?!\s*(?:m\b|s\b|sek|min))/i);
  const onlySets = text.match(/^\s*(\d+)\s*[×x]/i);
  const time = text.match(/(\d+(?:[.,]\d+)?)\s*(s|sek|sec|min)\b/i);
  const weight = text.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
  const num = (s: string) => Number(s.replace(",", "."));
  return {
    sets: setsMatch ? Number(setsMatch[1]) : onlySets ? Number(onlySets[1]) : null,
    reps: setsMatch ? Number(setsMatch[2]) : null,
    weightKg: weight ? num(weight[1]) : null,
    seconds: time ? Math.round(num(time[1]) * (time[2].toLowerCase() === "min" ? 60 : 1)) : null,
  };
}

/** Sekunden als m:ss. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Was pro Satz eingetragen wird. */
export const MEASURES = ["weight_reps", "reps", "time", "check"] as const;
export type Measure = (typeof MEASURES)[number];

/**
 * Eingabeart aus Vorgabe und Bibliothek ableiten (für Übungen ohne gespeicherte Art):
 * Zeitvorgabe ohne Wiederholungen → Zeit, Strecke → abhaken, Körpergewicht → nur Wiederholungen,
 * sonstige Gym-Übung → Gewicht × Wiederholungen.
 */
export function inferMeasure(prescription: string, libraryEquipment: string | null): Measure {
  const p = parsePrescription(prescription);
  if (p.seconds != null && p.reps == null) return "time";
  if (/\d\s*m\b/i.test(prescription)) return "check";
  if (libraryEquipment) return libraryEquipment === "bodyweight" ? "reps" : "weight_reps";
  if (p.reps != null) return "reps";
  return "check";
}
