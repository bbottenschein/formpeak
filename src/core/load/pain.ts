import { LOAD_CONFIG, type LoadConfig } from "./config";
import { addDays, type IsoDate } from "./dates";
import type { BodyRegion, BodySide, PainEntry, PainKind } from "./types";

export type PainLevel = "note" | "restrict" | "red";

export interface PainSpotStatus {
  region: BodyRegion;
  side: BodySide;
  /** Höchste Stärke am letzten Tag mit Eintrag. */
  intensity: number;
  /** Art am letzten Tag mit Eintrag (bei mehreren: die des stärksten Eintrags). */
  kind: PainKind;
  swollen: boolean;
  /** Anzahl der Tage mit Eintrag in der laufenden Serie. */
  seriesDays: number;
  /** Letzter Tag mit Eintrag. */
  lastDate: IsoDate;
  level: PainLevel;
  /** Rot-Regel greift → Hinweis auf Ärztin oder Physio. */
  seeProfessional: boolean;
}

const spotKey = (region: BodyRegion, side: BodySide) => `${region}|${side}`;

/**
 * Aktive Schmerzstellen am Tag `date` (SPEC 4.5).
 *
 * Eine Serie zählt Tage mit Eintrag ≥ 1. Tage ohne Morgen-Check-in unterbrechen sie nicht;
 * ein Morgen-Check-in ohne Eintrag an der Stelle beendet sie.
 * `morningCheckinDates`: alle Tage, an denen ein Morgen-Check-in gemacht wurde.
 */
export function activePainSpots(
  entries: PainEntry[],
  morningCheckinDates: Set<IsoDate>,
  date: IsoDate,
  config: LoadConfig = LOAD_CONFIG,
): PainSpotStatus[] {
  const { lookbackDays } = config.pain;
  const earliest = addDays(date, -lookbackDays);

  // Pro Stelle und Tag die Einträge sammeln.
  const bySpot = new Map<string, Map<IsoDate, PainEntry[]>>();
  for (const e of entries) {
    if (e.intensity < 1 || e.date > date || e.date < earliest) continue;
    const key = spotKey(e.region, e.side);
    const days = bySpot.get(key) ?? new Map<IsoDate, PainEntry[]>();
    days.set(e.date, [...(days.get(e.date) ?? []), e]);
    bySpot.set(key, days);
  }

  const result: PainSpotStatus[] = [];
  for (const days of bySpot.values()) {
    let seriesDays = 0;
    let latest: PainEntry[] | null = null;
    let lastDate: IsoDate | null = null;

    for (let d = date; d >= earliest; d = addDays(d, -1)) {
      const dayEntries = days.get(d);
      if (dayEntries) {
        seriesDays++;
        if (!latest) {
          latest = dayEntries;
          lastDate = d;
        }
      } else if (morningCheckinDates.has(d)) {
        break;
      }
    }
    if (!latest || !lastDate) continue;

    const strongest = latest.reduce((a, b) => (b.intensity > a.intensity ? b : a));
    const swollen = latest.some((e) => e.swollen && (e.kind === "joint" || e.kind === "tendon"));
    const status = classifyPain(strongest.intensity, swollen, seriesDays, config);
    result.push({
      region: strongest.region,
      side: strongest.side,
      intensity: strongest.intensity,
      kind: strongest.kind,
      swollen: latest.some((e) => e.swollen),
      seriesDays,
      lastDate,
      ...status,
    });
  }
  return result;
}

/** `swollenJointOrTendon`: Gelenk oder Sehne mit Schwellung. */
export function classifyPain(
  intensity: number,
  swollenJointOrTendon: boolean,
  seriesDays: number,
  config: LoadConfig = LOAD_CONFIG,
): { level: PainLevel; seeProfessional: boolean } {
  const p = config.pain;
  if (
    intensity >= p.redIntensity ||
    swollenJointOrTendon ||
    seriesDays > p.redSeriesLongerThanDays
  ) {
    return { level: "red", seeProfessional: true };
  }
  if (intensity >= p.restrictIntensity || seriesDays >= p.restrictSeriesDays) {
    return { level: "restrict", seeProfessional: false };
  }
  return { level: "note", seeProfessional: false };
}
