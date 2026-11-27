import { LOAD_CONFIG, type LoadConfig } from "./config";
import { addDays, dateRange, weekdayOf, type IsoDate } from "./dates";
import { matchdayContext } from "./matchday";
import { plannedLoad } from "./session-load";
import { weeklyLoad } from "./weekly-load";
import type { Session, TrafficLight } from "./types";

/**
 * Leitplanken für den Wochenplan (SPEC 4.6 / 7.2): Der Code entscheidet pro Tag, **ob** und wie
 * stark belastet werden darf. Die KI (oder der Regel-Plan) wählt nur innerhalb dieser Grenzen,
 * **was** trainiert wird. Verstöße werden erkannt und erzwungen korrigiert.
 */

export type PlanKind = "gym" | "run_intervals" | "mobility" | "recovery";
export const PLAN_KINDS: readonly PlanKind[] = ["gym", "run_intervals", "mobility", "recovery"];

export type AllowanceReason =
  | "past"
  | "matchday"
  | "md_plus_1"
  | "md_minus_1"
  | "team_training"
  | "light_red"
  | "light_yellow"
  | "not_available"
  | "lower_body_blocked"
  | "intense_blocked";

export interface DayAllowance {
  date: IsoDate;
  /** Haupteinheit (Gym, Lauf, längere Einheit) erlaubt. */
  main: boolean;
  kinds: PlanKind[];
  maxMinutes: number;
  maxRpe: number;
  /** Unterkörperkraft erlaubt (frühestens MD+2, spätestens MD−3). */
  lowerBody: boolean;
  reasons: AllowanceReason[];
}

export interface AllowanceInput {
  weekStart: IsoDate;
  today: IsoDate;
  /** Alle Einheiten rund um die Woche (mindestens ±7 Tage), inkl. Fußballterminen. */
  sessions: Session[];
  /** Tage für Zusatzeinheiten aus dem Ziel (0 = Sonntag … 6 = Samstag). */
  availableWeekdays: number[];
  timeBudgetMin: number;
  /** Ampel von heute (für andere Tage unbekannt). */
  todayLight?: TrafficLight;
}

const NONE: Pick<DayAllowance, "main" | "kinds" | "maxMinutes" | "maxRpe" | "lowerBody"> = {
  main: false,
  kinds: [],
  maxMinutes: 0,
  maxRpe: 0,
  lowerBody: false,
};

/** Erlaubter Rahmen pro Tag der Woche (Mo–So). */
export function dayAllowances(input: AllowanceInput, config: LoadConfig = LOAD_CONFIG): DayAllowance[] {
  const g = config.guardrails;
  const p = config.planning;
  const active = input.sessions.filter((s) => s.status !== "cancelled");
  const matchDates = active.filter((s) => s.type === "match").map((s) => s.date);
  const highTrainingDates = new Set(
    active.filter((s) => s.type === "training" && s.expectedIntensity === "high").map((s) => s.date),
  );

  return dateRange(input.weekStart, addDays(input.weekStart, 6)).map((date): DayAllowance => {
    if (date < input.today) return { date, ...NONE, reasons: ["past"] };
    const md = matchdayContext(date, matchDates);
    if (md.daysToNext === 0) return { date, ...NONE, reasons: ["matchday"] };

    const reasons: AllowanceReason[] = [];
    const lowerBody =
      (md.daysSinceLast == null || md.daysSinceLast >= p.lowerBodyEarliestAfterMatch) &&
      (md.daysToNext == null || md.daysToNext >= p.lowerBodyLatestBeforeMatch);
    const light = date === input.today ? input.todayLight : undefined;

    // Nur Regeneration: Ampel rot oder MD+1.
    if (light === "red" || md.daysSinceLast === 1) {
      reasons.push(light === "red" ? "light_red" : "md_plus_1");
      return {
        date,
        main: false,
        kinds: ["recovery", "mobility"],
        maxMinutes: g.recoveryMaxMinutes,
        maxRpe: g.recoveryMaxRpe,
        lowerBody: false,
        reasons,
      };
    }
    // MD−1: kurz aktivieren.
    if (md.daysToNext === 1) {
      return {
        date,
        main: false,
        kinds: ["mobility"],
        maxMinutes: g.activationMaxMinutes,
        maxRpe: g.activationMaxRpe,
        lowerBody: false,
        reasons: ["md_minus_1"],
      };
    }
    // Teamtraining: höchstens kurze Mobilität dazu.
    if (active.some((s) => s.date === date && s.type === "training")) {
      return {
        date,
        main: false,
        kinds: ["mobility"],
        maxMinutes: g.shortExtraMinutes,
        maxRpe: g.recoveryMaxRpe,
        lowerBody: false,
        reasons: ["team_training"],
      };
    }

    const available = input.availableWeekdays.includes(weekdayOf(date));
    if (!available) reasons.push("not_available");
    if (!lowerBody) reasons.push("lower_body_blocked");

    // Intensiv (RPE ≥ Schwelle) nicht direkt vor oder nach intensivem Teamtraining.
    const nearHigh = highTrainingDates.has(addDays(date, -1)) || highTrainingDates.has(addDays(date, 1));
    let maxRpe = available ? 9 : g.extraMaxRpe;
    if (available && nearHigh) {
      maxRpe = p.intenseRpe - 1;
      reasons.push("intense_blocked");
    }
    let maxMinutes = available ? input.timeBudgetMin : g.shortExtraMinutes;
    if (light === "yellow") {
      reasons.push("light_yellow");
      maxMinutes = Math.round(maxMinutes * (1 - p.yellowReduction));
      maxRpe = Math.min(maxRpe, p.intenseRpe - 1);
    }

    return {
      date,
      main: available,
      kinds: available ? [...PLAN_KINDS] : ["mobility", "recovery"],
      maxMinutes,
      maxRpe,
      lowerBody: available && lowerBody,
      reasons,
    };
  });
}

/** Eine geplante Zusatzeinheit, wie sie die Leitplanken prüfen. */
export interface PlanUnit {
  date: IsoDate;
  kind: PlanKind;
  durationMin: number;
  targetRpe: number;
  /** Belastet den Unterkörper mit Kraftübungen. */
  lowerBody: boolean;
}

/**
 * Haupteinheit = Gym, Lauf oder eine Einheit über dem RPE leichter Zusatzeinheiten.
 * Mobilität und Regeneration (RPE ≤ 4) zählen nicht zur gewählten Zahl der Einheiten.
 */
export function isMainUnit(u: Pick<PlanUnit, "kind" | "targetRpe">, config: LoadConfig = LOAD_CONFIG): boolean {
  return u.kind === "gym" || u.kind === "run_intervals" || u.targetRpe > config.guardrails.extraMaxRpe;
}

export type PlanViolation =
  | { code: "outside_week"; index: number }
  | { code: "kind_not_allowed"; index: number }
  | { code: "too_long"; index: number; max: number }
  | { code: "rpe_too_high"; index: number; max: number }
  | { code: "lower_body_blocked"; index: number }
  | { code: "too_many_main"; index: number; max: number }
  | { code: "too_many_per_day"; index: number; max: number }
  | { code: "no_rest_day" }
  | { code: "weekly_load_increase"; percent: number; maxPercent: number };

export interface PlanCheckContext {
  allowances: DayAllowance[];
  /** Einheiten, die bleiben (Fußball, selbst geplante, erledigte), rund um die Woche. */
  sessions: Session[];
  maxMainUnits: number;
  today: IsoDate;
}

function unitAsSession(u: PlanUnit, i: number): Session {
  return {
    id: `plan-${i}`,
    date: u.date,
    type: u.kind,
    status: "planned",
    durationMin: u.durationMin,
    rpe: null,
    targetRpe: u.targetRpe,
    defaultRpe: u.targetRpe,
    isFixture: false,
  };
}

/**
 * Wochenlast für die 15-%-Regel: bestehende Einheiten der Woche plus Haupteinheiten des Plans
 * (kurze, leichte Zusatzeinheiten zählen nicht – sie dienen der Erholung). Vergleichswert ist die
 * Vorwoche bzw. der Wochenschnitt der letzten vier Wochen, falls dieser höher ist.
 */
export function weekLoads(
  units: PlanUnit[],
  ctx: PlanCheckContext,
  config: LoadConfig = LOAD_CONFIG,
): { existing: number; plan: number; reference: number } {
  const { planned, reference } = weeklyLoad(ctx.allowances[0].date, ctx.sessions, ctx.today, config);
  const plan = units
    .map((u, i) => (isMainUnit(u, config) ? plannedLoad(unitAsSession(u, i)) : 0))
    .reduce((a, b) => a + b, 0);
  return { existing: planned, plan, reference };
}

/** Alle Verstöße eines Plans gegen die Leitplanken. */
export function validatePlan(units: PlanUnit[], ctx: PlanCheckContext, config: LoadConfig = LOAD_CONFIG): PlanViolation[] {
  const out: PlanViolation[] = [];
  const byDate = new Map(ctx.allowances.map((a) => [a.date, a]));
  let mains = 0;
  const perDay = new Map<IsoDate, number>();

  units.forEach((u, index) => {
    const a = byDate.get(u.date);
    if (!a || a.reasons.includes("past")) {
      out.push({ code: "outside_week", index });
      return;
    }
    if (!a.kinds.includes(u.kind) || (isMainUnit(u, config) && !a.main)) {
      out.push({ code: "kind_not_allowed", index });
      return;
    }
    if (u.durationMin > a.maxMinutes) out.push({ code: "too_long", index, max: a.maxMinutes });
    if (u.targetRpe > a.maxRpe) out.push({ code: "rpe_too_high", index, max: a.maxRpe });
    if (u.lowerBody && !a.lowerBody) out.push({ code: "lower_body_blocked", index });
    if (isMainUnit(u, config) && ++mains > ctx.maxMainUnits) {
      out.push({ code: "too_many_main", index, max: ctx.maxMainUnits });
    }
    const n = (perDay.get(u.date) ?? 0) + 1;
    perDay.set(u.date, n);
    if (n > config.guardrails.maxUnitsPerDay) {
      out.push({ code: "too_many_per_day", index, max: config.guardrails.maxUnitsPerDay });
    }
  });

  if (!hasRestDay(units, ctx)) out.push({ code: "no_rest_day" });

  const { existing, plan, reference } = weekLoads(units, ctx, config);
  const max = config.planning.maxWeeklyIncrease;
  const increase = reference > 0 ? (existing + plan) / reference - 1 : 0;
  if (plan > 0 && increase > max + 1e-9) {
    out.push({ code: "weekly_load_increase", percent: Math.round(increase * 100), maxPercent: Math.round(max * 100) });
  }
  return out;
}

/** Mindestens ein Tag der Woche ganz ohne Einheit (Fußball eingeschlossen). */
function hasRestDay(units: PlanUnit[], ctx: PlanCheckContext): boolean {
  const busy = new Set([
    ...ctx.sessions.filter((s) => s.status !== "cancelled").map((s) => s.date),
    ...units.map((u) => u.date),
  ]);
  return ctx.allowances.some((a) => !busy.has(a.date));
}

/** Ob die Woche ohne den Plan überhaupt einen Ruhetag hätte (sonst ist die Regel nicht erfüllbar). */
function restDayPossible(ctx: PlanCheckContext): boolean {
  return hasRestDay([], ctx);
}

/**
 * Setzt die Leitplanken durch, falls die KI sie auch nach Rückfrage verletzt:
 * Einheiten an verbotenen Tagen fallen weg, Dauer und RPE werden gekappt, zu viele Haupteinheiten
 * und Einheiten pro Tag fallen weg, ein Ruhetag wird freigeräumt und die Wochenlast gekürzt.
 * Liefert die Indizes der behaltenen Einheiten mit ihren (ggf. gekürzten) Werten.
 */
export function enforcePlan<T extends PlanUnit>(
  units: T[],
  ctx: PlanCheckContext,
  config: LoadConfig = LOAD_CONFIG,
): T[] {
  const byDate = new Map(ctx.allowances.map((a) => [a.date, a]));
  let kept: T[] = [];
  let mains = 0;
  const perDay = new Map<IsoDate, number>();

  for (const u of [...units].sort((a, b) => a.date.localeCompare(b.date))) {
    const a = byDate.get(u.date);
    if (!a || a.reasons.includes("past") || !a.kinds.includes(u.kind)) continue;
    if (u.lowerBody && !a.lowerBody) continue;
    const main = isMainUnit(u, config);
    if (main && (!a.main || mains >= ctx.maxMainUnits)) continue;
    const n = perDay.get(u.date) ?? 0;
    if (n >= config.guardrails.maxUnitsPerDay) continue;
    perDay.set(u.date, n + 1);
    if (main) mains++;
    kept.push({
      ...u,
      durationMin: Math.min(u.durationMin, a.maxMinutes),
      targetRpe: Math.min(u.targetRpe, a.maxRpe),
    });
  }

  // Wochenlast: erst überzählige Haupteinheiten (die spätesten) streichen, dann kürzen.
  const { existing, reference } = weekLoads(kept, ctx, config);
  if (reference > 0) {
    const budget = reference * (1 + config.planning.maxWeeklyIncrease) - existing;
    const planOf = (list: T[]) => weekLoads(list, ctx, config).plan;
    const mainsOf = (list: T[]) => list.filter((u) => isMainUnit(u, config));
    while (planOf(kept) > budget && mainsOf(kept).length > 1) {
      const last = mainsOf(kept).at(-1)!;
      kept = kept.filter((u) => u !== last);
    }
    const plan = planOf(kept);
    if (plan > budget) {
      const factor = Math.max(0, budget / plan);
      // Kürzen nur, solange die Einheit sinnvoll bleibt; sonst fällt sie weg.
      kept = kept
        .map((u) =>
          isMainUnit(u, config) ? { ...u, durationMin: Math.floor((u.durationMin * factor) / 5) * 5 } : u,
        )
        .filter((u) => !isMainUnit(u, config) || u.durationMin >= config.guardrails.minMainMinutes);
    }
  }
  // Ruhetag: Den Tag mit der kleinsten Plan-Last ohne andere Einheiten freiräumen.
  if (!hasRestDay(kept, ctx) && restDayPossible(ctx)) {
    const othersBusy = new Set(ctx.sessions.filter((s) => s.status !== "cancelled").map((s) => s.date));
    const loadOf = (d: IsoDate) =>
      kept.filter((u) => u.date === d).reduce((sum, u) => sum + u.durationMin * u.targetRpe, 0);
    const candidate = ctx.allowances
      .map((a) => a.date)
      .filter((d) => !othersBusy.has(d))
      .sort((x, y) => loadOf(x) - loadOf(y))[0];
    if (candidate) kept = kept.filter((u) => u.date !== candidate);
  }

  return kept;
}
