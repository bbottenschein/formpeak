import type { DayAllowance, OffseasonWeek } from "@/core/load";
import { ROUTINES, type Routine, type RoutineKey } from "@/features/today/routines";

/**
 * Regel-Plan ohne KI (kein API-Schlüssel oder KI fällt aus): verteilt Routinen aus der kuratierten
 * Bibliothek auf die Woche. Haupteinheiten an den gewählten Tagen im Wechsel passend zum Ziel,
 * MD−1 Aktivierung, MD+1 Regeneration, freie Tage kurze Mobilität. Die Leitplanken prüft danach
 * `enforcePlan` wie beim KI-Plan.
 */

/** Ziel → Haupteinheiten im Wechsel. */
const GOAL_ROTATION: Record<string, RoutineKey[]> = {
  endurance: ["intervals_4x4", "easy_run", "prevention_core"],
  speed: ["acceleration", "strength_full", "prevention_core"],
  strength: ["strength_full", "prevention_core"],
  muscle_gain: ["strength_full", "prevention_core"],
  weight_loss: ["easy_run", "strength_full", "intervals_4x4"],
  prevention: ["prevention_core", "strength_full"],
  comeback: ["prevention_core", "easy_run"],
};

export interface RulesPlanItem {
  date: string;
  routine: RoutineKey;
  durationMin: number;
  targetRpe: number;
  lowerBody: boolean;
}

/** Routine belastet den Unterkörper mit Kraftübungen. */
export const routineLowerBody = (r: Routine) => r.key === "strength_full";

function fits(r: Routine, a: DayAllowance, equipment: string[]): boolean {
  return (
    a.kinds.includes(r.sessionType as DayAllowance["kinds"][number]) &&
    r.needs.every((n) => equipment.includes(n)) &&
    r.rpe <= a.maxRpe &&
    (!routineLowerBody(r) || a.lowerBody)
  );
}

/**
 * Off-Season: Erholen nur locker; Aufbauen = Ziel-Rotation mit Pflicht-Sprint und -Prävention;
 * Zurück zum Fußball = Sprint, Intervalle, Kraft erhalten, Prävention.
 */
export function offseasonRotation(goalType: string | null, block: OffseasonWeek["block"]): RoutineKey[] {
  if (block === "recover") return ["easy_run", "recovery_flush"];
  if (block === "return") return ["acceleration", "intervals_4x4", "strength_full", "prevention_core"];
  const goal = GOAL_ROTATION[goalType ?? ""] ?? ["strength_full", "intervals_4x4"];
  const out: RoutineKey[] = [goal[0], "acceleration", ...goal.slice(1)];
  if (!out.some((k) => ROUTINES[k].focus.includes("prevention"))) out.push("prevention_core");
  return [...new Set(out)];
}

export function rulesPlan(
  allowances: DayAllowance[],
  opts: { goalType: string | null; equipment: string[]; maxMainUnits: number; offseason?: OffseasonWeek },
): RulesPlanItem[] {
  const rotation = opts.offseason
    ? offseasonRotation(opts.goalType, opts.offseason.block)
    : (GOAL_ROTATION[opts.goalType ?? ""] ?? ["prevention_core"]);
  const items: RulesPlanItem[] = [];
  let mains = 0;
  let next = 0;

  const add = (date: string, r: Routine, maxMinutes: number) =>
    items.push({
      date,
      routine: r.key,
      durationMin: Math.min(r.minutes, maxMinutes),
      targetRpe: r.rpe,
      lowerBody: routineLowerBody(r),
    });

  for (const a of allowances) {
    if (a.kinds.length === 0) continue;
    if (a.reasons.includes("md_minus_1")) {
      add(a.date, ROUTINES.activation_md1, a.maxMinutes);
    } else if (a.reasons.includes("md_plus_1") || a.reasons.includes("light_red")) {
      add(a.date, ROUTINES.recovery_flush, a.maxMinutes);
    } else if (a.reasons.includes("team_training")) {
      continue;
    } else if (a.main && mains < opts.maxMainUnits) {
      // Nächste passende Routine aus der Rotation, sonst Prävention.
      let chosen: Routine | null = null;
      for (let i = 0; i < rotation.length && !chosen; i++) {
        const r = ROUTINES[rotation[(next + i) % rotation.length]];
        if (fits(r, a, opts.equipment)) {
          chosen = r;
          next = (next + i + 1) % rotation.length;
        }
      }
      const r = chosen ?? (opts.offseason?.block === "recover" ? ROUTINES.recovery_flush : ROUTINES.prevention_core);
      add(a.date, r, a.maxMinutes);
      // Jede Einheit an einem gewählten Tag zählt zur gewünschten Anzahl (auch leichte).
      mains++;
    } else if (!opts.offseason) {
      // Saison: freie Tage ohne Haupteinheit bekommen kurze Mobilität. Off-Season: Ruhe.
      add(a.date, ROUTINES.mobility_hip_groin, a.maxMinutes);
    }
  }
  return items;
}

/**
 * „Lieber etwas anderes“ ohne KI: eine andere Routine, die in den Tagesrahmen passt.
 * Pflichtinhalte der bisherigen Einheit (Sprint, Prävention) bleiben erhalten; sonst bevorzugt
 * die Routine mit den meisten gemeinsamen Inhalten.
 */
export function rulesAlternative(
  allowance: DayAllowance,
  current: { routineKey: string | null; title: string; focus: string[] },
  equipment: string[],
  routineTitle: (k: RoutineKey) => string,
): RoutineKey | null {
  const keep = current.focus.filter((f) => f === "sprint" || f === "prevention");
  const candidates = (Object.keys(ROUTINES) as RoutineKey[])
    .map((k) => ROUTINES[k])
    .filter((r) => r.key !== current.routineKey && routineTitle(r.key) !== current.title)
    .filter((r) => fits(r, allowance, equipment) && (r.sessionType === "mobility" || r.sessionType === "recovery" || allowance.main))
    .filter((r) => keep.every((f) => r.focus.includes(f as never)));
  if (candidates.length === 0) return null;
  const overlap = (r: Routine) => r.focus.filter((f) => current.focus.includes(f)).length;
  return candidates.sort((a, b) => overlap(b) - overlap(a))[0].key;
}
