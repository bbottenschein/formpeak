import { LOAD_CONFIG, type LoadConfig } from "./config";
import { isMainUnit, type DayAllowance, type PlanUnit } from "./guardrails";
import type { PainSpotStatus } from "./pain";

/**
 * Tägliche Anpassung (SPEC 7.2 Schritt 5): Nach dem Morgen-Check-in prüft der Code die heutigen
 * Vorschläge gegen den Rahmen von heute (Ampel, Schmerz) und kürzt, tauscht oder streicht sie.
 * Die KI entscheidet hier nichts – sie formuliert höchstens Übungen um (Schmerzregion aussparen).
 */

export type AdjustReason = "light_red" | "light_yellow" | "pain" | "rules";

export type AdjustAction =
  | { action: "keep" }
  | { action: "shorten"; durationMin: number; targetRpe: number; setFactor: number }
  | { action: "swap"; to: "recovery" | "mobility"; durationMin: number; targetRpe: number }
  | { action: "remove" };

export interface UnitAdjustment {
  id: string;
  change: AdjustAction;
  /** Übungen so umstellen, dass schmerzende Regionen ausgespart werden. */
  spare: boolean;
  reason: AdjustReason | null;
}

export interface TodayUnit extends PlanUnit {
  id: string;
}

/** Dauer eines Tauschs: Regeneration 25 min, Mobilität 15 min (höchstens der Rahmen). */
const SWAP_MINUTES = { recovery: 25, mobility: 15 } as const;
const SWAP_RPE = { recovery: 2, mobility: 3 } as const;

export function adjustToday(
  units: TodayUnit[],
  allowance: DayAllowance,
  painSpots: PainSpotStatus[],
  config: LoadConfig = LOAD_CONFIG,
): UnitAdjustment[] {
  const restrict = painSpots.some((s) => s.level === "restrict");
  const reasonFor = (): AdjustReason =>
    allowance.reasons.includes("light_red")
      ? "light_red"
      : allowance.reasons.includes("light_yellow")
        ? "light_yellow"
        : "rules";
  let swapped = false;

  return units.map((u): UnitAdjustment => {
    const allowedKind = allowance.kinds.includes(u.kind) && (!isMainUnit(u, config) || allowance.main);
    const allowedBody = !u.lowerBody || allowance.lowerBody;

    if (!allowedKind || !allowedBody) {
      const to: "recovery" | "mobility" | null = allowance.kinds.includes("recovery")
        ? "recovery"
        : allowance.kinds.includes("mobility")
          ? "mobility"
          : null;
      // Pro Tag höchstens ein Ersatz; bleibt schon eine leichte Einheit, fällt die Einheit ganz weg.
      const lightStays = units.some((o) => o !== u && allowance.kinds.includes(o.kind) && !isMainUnit(o, config));
      if (!to || swapped || lightStays) {
        return { id: u.id, change: { action: "remove" }, spare: false, reason: reasonFor() };
      }
      swapped = true;
      return {
        id: u.id,
        change: {
          action: "swap",
          to,
          durationMin: Math.min(SWAP_MINUTES[to], allowance.maxMinutes),
          targetRpe: Math.min(SWAP_RPE[to], allowance.maxRpe),
        },
        spare: false,
        reason: reasonFor(),
      };
    }

    const spare = restrict && isMainUnit(u, config);
    if (u.durationMin > allowance.maxMinutes || u.targetRpe > allowance.maxRpe) {
      const durationMin = Math.min(u.durationMin, allowance.maxMinutes);
      return {
        id: u.id,
        change: {
          action: "shorten",
          durationMin,
          targetRpe: Math.min(u.targetRpe, allowance.maxRpe),
          setFactor: durationMin / u.durationMin,
        },
        spare,
        reason: reasonFor(),
      };
    }
    return { id: u.id, change: { action: "keep" }, spare, reason: spare ? "pain" : null };
  });
}

/**
 * Weniger Sätze bei gekürzter Einheit: „4 × 5, 60 kg“ mit Faktor 0,7 → „3 × 5, 60 kg“.
 * Vorgaben ohne Satzangabe bleiben unverändert.
 */
export function reducePrescription(text: string, factor: number): string {
  if (factor >= 1) return text;
  return text.replace(/^(\d+)(\s*[×x]\s*)/, (_, n: string, sep: string) => `${Math.max(1, Math.round(Number(n) * factor))}${sep}`);
}

