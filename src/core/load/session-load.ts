import type { IsoDate } from "./dates";
import type { Session } from "./types";

export interface SessionLoad {
  /** Last in Arbeitseinheiten (AU) = RPE × Dauer. */
  load: number;
  /** true, wenn der Standard-RPE statt eines eingetragenen RPE verwendet wurde. */
  estimated: boolean;
  /** true, wenn die Einheit in die tatsächliche Last eingeht. */
  counts: boolean;
}

/**
 * Tatsächliche Last einer Einheit (sRPE nach Foster).
 *
 * - Ausgefallen → 0.
 * - Absolviert → RPE × Dauer; ohne RPE mit Standard-RPE (geschätzt).
 * - Geplant: Ein fester Fußballtermin in der Vergangenheit gilt als absolviert (geschätzt),
 *   bis der Nutzer ihn korrigiert. Selbst geplante Einheiten zählen erst, wenn sie absolviert sind.
 */
export function sessionLoad(session: Session, today: IsoDate): SessionLoad {
  if (session.status === "cancelled") return { load: 0, estimated: false, counts: false };

  const pastFixture = session.status === "planned" && session.isFixture && session.date < today;
  if (session.status === "planned" && !pastFixture) {
    return { load: 0, estimated: false, counts: false };
  }

  const hasRpe = session.status === "done" && session.rpe != null;
  const rpe = hasRpe ? session.rpe! : session.defaultRpe;
  return { load: rpe * session.durationMin, estimated: !hasRpe, counts: true };
}

/** Geplante Last (für die Wochenplanung): Ziel-RPE bzw. Standard-RPE × Dauer. */
export function plannedLoad(session: Session): number {
  if (session.status === "cancelled") return 0;
  if (session.status === "done" && session.rpe != null) return session.rpe * session.durationMin;
  const rpe = session.targetRpe ?? session.defaultRpe;
  return rpe * session.durationMin;
}

/** Summe der tatsächlichen Last pro Tag. */
export function dailyLoads(sessions: Session[], today: IsoDate): Map<IsoDate, number> {
  const out = new Map<IsoDate, number>();
  for (const s of sessions) {
    const { load, counts } = sessionLoad(s, today);
    if (!counts) continue;
    out.set(s.date, (out.get(s.date) ?? 0) + load);
  }
  return out;
}
