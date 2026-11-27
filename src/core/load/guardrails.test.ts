import { describe, expect, it } from "vitest";
import { LOAD_CONFIG } from "./config";
import {
  dayAllowances,
  enforcePlan,
  isMainUnit,
  validatePlan,
  weekLoads,
  type AllowanceInput,
  type PlanCheckContext,
  type PlanUnit,
} from "./guardrails";
import type { OffseasonWeek } from "./offseason";
import { match, session, training } from "./test-helpers";
import type { Session } from "./types";

/**
 * Referenzwoche (SPEC 4.6): Training Di + Do (Do intensiv), Spiel Sa; Spiel auch am Sa davor.
 * Mo 30.11. = MD+2, Di Training, Mi 02.12. = MD−3, Do Training, Fr = MD−1, Sa Spiel, So = MD+1.
 * Zusatzeinheiten möglich Mo, Mi, Fr.
 */
const MONDAY = "2026-11-30";
const FIXTURES: Session[] = [
  match("2026-11-28"),
  training("2026-11-24"),
  training("2026-11-26"),
  // Vorwoche mit zwei Gym-Einheiten → genug Spielraum für Zusatzeinheiten (Wochenlast-Regel).
  session({ date: "2026-11-23", durationMin: 60, rpe: 6 }),
  session({ date: "2026-11-25", durationMin: 60, rpe: 6 }),
  training("2026-12-01"),
  training("2026-12-03", { expectedIntensity: "high" }),
  match("2026-12-05"),
];
const input = (extra: Partial<AllowanceInput> = {}): AllowanceInput => ({
  weekStart: MONDAY,
  today: MONDAY,
  sessions: FIXTURES,
  availableWeekdays: [1, 3, 5],
  timeBudgetMin: 60,
  ...extra,
});
const byDate = (extra: Partial<AllowanceInput> = {}) =>
  Object.fromEntries(dayAllowances(input(extra)).map((a) => [a.date, a]));

describe("dayAllowances – Referenzwoche", () => {
  const a = byDate();

  it("Mo (MD+2, frei): Haupteinheit mit Unterkörper, volles Zeitbudget", () => {
    expect(a["2026-11-30"]).toMatchObject({ main: true, lowerBody: true, maxMinutes: 60, maxRpe: 9 });
  });

  it("Di/Do Teamtraining: nur 15 min Mobilität", () => {
    for (const d of ["2026-12-01", "2026-12-03"]) {
      expect(a[d]).toMatchObject({ main: false, kinds: ["mobility"], maxMinutes: 15 });
      expect(a[d].reasons).toContain("team_training");
    }
  });

  it("Mi (MD−3, vor intensivem Training): Unterkörper ja, aber nicht intensiv", () => {
    expect(a["2026-12-02"]).toMatchObject({ main: true, lowerBody: true, maxRpe: LOAD_CONFIG.planning.intenseRpe - 1 });
    expect(a["2026-12-02"].reasons).toContain("intense_blocked");
  });

  it("Fr (MD−1): nur kurz aktivieren, obwohl als Tag gewählt", () => {
    expect(a["2026-12-04"]).toMatchObject({ main: false, kinds: ["mobility"], maxMinutes: 20, maxRpe: 4 });
  });

  it("Sa Spieltag: nichts", () => {
    expect(a["2026-12-05"]).toMatchObject({ main: false, kinds: [], maxMinutes: 0 });
    expect(a["2026-12-05"].reasons).toEqual(["matchday"]);
  });

  it("So (MD+1): nur Regeneration bis 30 min, RPE 3", () => {
    expect(a["2026-12-06"]).toMatchObject({ main: false, kinds: ["recovery", "mobility"], maxMinutes: 30, maxRpe: 3 });
  });
});

describe("dayAllowances – Grenzen", () => {
  it("Unterkörper genau MD−3 erlaubt, MD−2 nicht", () => {
    const a = byDate({ sessions: [match("2026-12-05")], availableWeekdays: [0, 1, 2, 3, 4, 5, 6] });
    expect(a["2026-12-02"].lowerBody).toBe(true); // MD−3
    expect(a["2026-12-03"].lowerBody).toBe(false); // MD−2
    expect(a["2026-12-03"].main).toBe(true);
  });

  it("Unterkörper genau MD+2 erlaubt", () => {
    const a = byDate({ sessions: [match("2026-11-28")], availableWeekdays: [0, 1, 2, 3, 4, 5, 6] });
    expect(a["2026-11-30"].lowerBody).toBe(true); // MD+2
  });

  it("Tage vor heute sind gesperrt", () => {
    const a = byDate({ today: "2026-12-02" });
    expect(a["2026-11-30"].reasons).toEqual(["past"]);
    expect(a["2026-12-02"].main).toBe(true);
  });

  it("nicht gewählter freier Tag: nur 15 min leichte Einheit", () => {
    const a = byDate({ sessions: [], availableWeekdays: [1] });
    expect(a["2026-12-02"]).toMatchObject({ main: false, kinds: ["mobility", "recovery"], maxMinutes: 15, maxRpe: 4 });
  });

  it("Ampel rot heute: nur Regeneration", () => {
    const a = byDate({ todayLight: "red" });
    expect(a[MONDAY]).toMatchObject({ main: false, maxMinutes: 30, maxRpe: 3 });
    expect(a[MONDAY].reasons).toContain("light_red");
  });

  it("Ampel gelb heute: Umfang −30 %, nicht intensiv", () => {
    const a = byDate({ todayLight: "yellow" });
    expect(a[MONDAY]).toMatchObject({ main: true, maxMinutes: 42, maxRpe: 6 });
  });

  it("Ampel gilt nur für heute", () => {
    const a = byDate({ todayLight: "red" });
    expect(a["2026-12-02"].main).toBe(true);
  });
});

describe("isMainUnit", () => {
  it("Gym und Lauf immer, Mobilität/Regeneration erst über RPE 4", () => {
    expect(isMainUnit({ kind: "gym", targetRpe: 3 })).toBe(true);
    expect(isMainUnit({ kind: "run_intervals", targetRpe: 3 })).toBe(true);
    expect(isMainUnit({ kind: "mobility", targetRpe: 4 })).toBe(false);
    expect(isMainUnit({ kind: "recovery", targetRpe: 5 })).toBe(true);
  });
});

const unit = (date: string, extra: Partial<PlanUnit> = {}): PlanUnit => ({
  date,
  kind: "gym",
  durationMin: 45,
  targetRpe: 6,
  lowerBody: false,
  ...extra,
});
const ctx = (extra: Partial<PlanCheckContext> = {}): PlanCheckContext => ({
  allowances: dayAllowances(input()),
  sessions: FIXTURES,
  maxMainUnits: 2,
  today: MONDAY,
  ...extra,
});
const codes = (units: PlanUnit[], extra: Partial<PlanCheckContext> = {}) =>
  validatePlan(units, ctx(extra)).map((v) => v.code);

describe("validatePlan", () => {
  it("ein regelkonformer Plan hat keine Verstöße", () => {
    const plan = [
      unit("2026-11-30", { lowerBody: true, targetRpe: 7 }),
      unit("2026-12-01", { kind: "mobility", durationMin: 15, targetRpe: 2 }),
      unit("2026-12-02", { kind: "gym", durationMin: 45, targetRpe: 6 }),
      unit("2026-12-04", { kind: "mobility", durationMin: 15, targetRpe: 3 }),
    ];
    expect(codes(plan)).toEqual([]);
  });

  it("Gym am MD−1 ist nicht erlaubt", () => {
    expect(codes([unit("2026-12-04")])).toEqual(["kind_not_allowed"]);
  });

  it("Unterkörper an MD−2 ist gesperrt", () => {
    const c = ctx({
      allowances: dayAllowances(input({ sessions: [match("2026-12-05")], availableWeekdays: [4] })),
      sessions: [match("2026-12-05")],
    });
    expect(validatePlan([unit("2026-12-03", { lowerBody: true })], c).map((v) => v.code)).toEqual(["lower_body_blocked"]);
  });

  it("zu lang und zu intensiv", () => {
    expect(codes([unit("2026-12-02", { durationMin: 75, targetRpe: 8 })])).toEqual(["too_long", "rpe_too_high"]);
  });

  it("mehr Haupteinheiten als gewählt", () => {
    expect(codes([unit("2026-11-30"), unit("2026-12-02")], { maxMainUnits: 1 })).toEqual(["too_many_main"]);
  });

  it("Tage außerhalb der Woche oder in der Vergangenheit", () => {
    expect(codes([unit("2026-12-07")])).toEqual(["outside_week"]);
    expect(codes([unit("2026-11-30")], { allowances: dayAllowances(input({ today: "2026-12-01" })) })).toEqual([
      "outside_week",
    ]);
  });

  it("kein Ruhetag mehr", () => {
    const plan = [
      unit("2026-11-30"),
      unit("2026-12-01", { kind: "mobility", durationMin: 10, targetRpe: 2 }),
      unit("2026-12-02"),
      unit("2026-12-03", { kind: "mobility", durationMin: 10, targetRpe: 2 }),
      unit("2026-12-04", { kind: "mobility", durationMin: 10, targetRpe: 2 }),
      unit("2026-12-06", { kind: "recovery", durationMin: 20, targetRpe: 2 }),
    ];
    expect(codes(plan)).toEqual(["no_rest_day"]);
  });

  it("Wochenlast steigt um mehr als 15 %", () => {
    const sessions = [session({ date: "2026-11-25", durationMin: 60, rpe: 5 })]; // 300 AU
    const c = { allowances: dayAllowances(input({ sessions, timeBudgetMin: 90 })), sessions };
    // 300 → 345 ist genau +15 % (erlaubt), 350 nicht.
    expect(codes([unit("2026-12-02", { durationMin: 69, targetRpe: 5 })], c)).toEqual([]);
    expect(codes([unit("2026-12-02", { durationMin: 70, targetRpe: 5 })], c)).toEqual(["weekly_load_increase"]);
  });

  it("kurze Mobilität zählt nicht zur Wochenlast", () => {
    const sessions = [session({ date: "2026-11-25", durationMin: 10, rpe: 1 })];
    const c = { allowances: dayAllowances(input({ sessions })), sessions };
    expect(codes([unit("2026-12-01", { kind: "mobility", durationMin: 15, targetRpe: 3 })], c)).toEqual([]);
  });
});

describe("enforcePlan", () => {
  it("entfernt verbotene Einheiten und kappt Dauer und RPE", () => {
    const kept = enforcePlan(
      [unit("2026-12-04"), unit("2026-12-02", { durationMin: 90, targetRpe: 8 }), unit("2026-12-05", { kind: "mobility", durationMin: 10 })],
      ctx(),
    );
    expect(kept).toEqual([unit("2026-12-02", { durationMin: 60, targetRpe: 6 })]);
  });

  it("behält höchstens die gewählte Zahl Haupteinheiten (die frühesten)", () => {
    const kept = enforcePlan([unit("2026-12-02"), unit("2026-11-30")], ctx({ maxMainUnits: 1 }));
    expect(kept.map((u) => u.date)).toEqual(["2026-11-30"]);
  });

  it("räumt einen Ruhetag frei", () => {
    const plan = [
      unit("2026-11-30"),
      unit("2026-12-02"),
      unit("2026-12-04", { kind: "mobility", durationMin: 10, targetRpe: 2 }),
      unit("2026-12-06", { kind: "recovery", durationMin: 20, targetRpe: 2 }),
    ];
    const kept = enforcePlan(plan, ctx());
    expect(validatePlan(kept, ctx()).map((v) => v.code)).toEqual([]);
    expect(kept).toHaveLength(3);
  });

  it("Wochenlast: streicht erst die spätere Haupteinheit, kürzt dann", () => {
    const sessions = [session({ date: "2026-11-25", durationMin: 60, rpe: 5 })]; // 300 AU → max. 345
    const c = { ...ctx(), allowances: dayAllowances(input({ sessions })), sessions };
    const kept = enforcePlan(
      [
        unit("2026-11-30", { durationMin: 60, targetRpe: 6 }),
        unit("2026-12-01", { kind: "mobility", durationMin: 15, targetRpe: 2 }),
        unit("2026-12-02", { durationMin: 60, targetRpe: 6 }),
      ],
      c,
    );
    expect(validatePlan(kept, c).map((v) => v.code)).toEqual([]);
    expect(kept.map((u) => [u.date, u.durationMin])).toEqual([
      ["2026-11-30", 55],
      ["2026-12-01", 15],
    ]);
  });

  it("Vorwoche zählt kommende Termine mit geplanter Last (laufende Woche)", () => {
    // Heute Fr 27.11.: Spiel Sa 28.11. gehört zur Vorwoche der geplanten Woche.
    const sessions = [training("2026-11-24"), match("2026-11-28"), training("2026-12-01"), match("2026-12-05")];
    const c = { ...ctx(), today: "2026-11-27", allowances: dayAllowances(input({ sessions, today: "2026-11-27" })), sessions };
    expect(weekLoads([], c).reference).toBe(540 + 720);
    expect(weekLoads([], c).existing).toBe(540 + 720);
  });

  it("zu kurz gekürzte Haupteinheiten fallen weg (unter 20 min)", () => {
    const sessions = [session({ date: "2026-11-25", durationMin: 20, rpe: 5 })]; // 100 AU → max. 115
    const c = { ...ctx(), allowances: dayAllowances(input({ sessions })), sessions };
    expect(enforcePlan([unit("2026-11-30", { durationMin: 45, targetRpe: 6 })], c)).toEqual([]);
  });

  it("Wochenlast schon durch Fußball ausgeschöpft: nur leichte Einheiten bleiben", () => {
    const sessions = [training("2026-11-25", { durationMin: 30 }), training("2026-12-01"), training("2026-12-03")];
    const c = { ...ctx(), allowances: dayAllowances(input({ sessions })), sessions };
    const kept = enforcePlan([unit("2026-11-30"), unit("2026-12-01", { kind: "mobility", durationMin: 15, targetRpe: 2 })], c);
    expect(kept.map((u) => u.kind)).toEqual(["mobility"]);
  });

  it("ein regelkonformer Plan bleibt unverändert", () => {
    const plan = [unit("2026-11-30", { lowerBody: true }), unit("2026-12-01", { kind: "mobility", durationMin: 15, targetRpe: 2 })];
    expect(enforcePlan(plan, ctx())).toEqual(plan);
  });
});

describe("Off-Season-Leitplanken", () => {
  // Keine Fußballtermine, freie Tage Mo, Mi, Fr, Sa; Vorwoche 4 × 60 min RPE 6 = 1440 AU.
  const prev = ["2026-11-23", "2026-11-25", "2026-11-27", "2026-11-28"].map((date) =>
    session({ date, durationMin: 60, rpe: 6 }),
  );
  const build: OffseasonWeek = { week: 3, totalWeeks: 7, block: "build", deload: false, weeksToPreseason: 5 };
  const oc = (offseason: OffseasonWeek, extra: Partial<PlanCheckContext> = {}): PlanCheckContext => ({
    allowances: dayAllowances({ ...input({ sessions: prev, availableWeekdays: [1, 3, 5, 6] }), offseason }),
    sessions: prev,
    maxMainUnits: 4,
    today: MONDAY,
    offseason,
    ...extra,
  });
  const gymF = (date: string, focus: PlanUnit["focus"]) => unit(date, { durationMin: 60, targetRpe: 6, focus });
  const full = [
    gymF("2026-11-30", ["strength", "prevention"]),
    gymF("2026-12-02", ["sprint", "endurance_hiit"]),
    gymF("2026-12-04", ["strength"]),
    gymF("2026-12-05", ["endurance_base"]),
  ];

  it("Erholen: Intensität höchstens RPE 4", () => {
    const a = dayAllowances({ ...input({ sessions: [], availableWeekdays: [1] }), offseason: { ...build, block: "recover" } });
    expect(a[0]).toMatchObject({ main: true, maxRpe: 4 });
    expect(a[0].reasons).toContain("offseason_recover");
  });

  it("Aufbau mit Sprint und Prävention, 3 Ruhetage: regelkonform", () => {
    expect(validatePlan(full, oc(build)).map((v) => v.code)).toEqual([]);
  });

  it("Aufbau ohne Sprint: Pflichtinhalt fehlt", () => {
    const noSprint = full.map((u) => ({ ...u, focus: u.focus?.filter((f) => f !== "sprint") }));
    expect(validatePlan(noSprint, oc(build))).toContainEqual({ code: "missing_focus", focus: "sprint" });
  });

  it("Erholen: keine Pflichtinhalte", () => {
    const easy = [unit("2026-11-30", { kind: "mobility", durationMin: 30, targetRpe: 3 })];
    expect(validatePlan(easy, oc({ ...build, block: "recover" })).map((v) => v.code)).toEqual([]);
  });

  it("2 Ruhetage Pflicht; bei 6 gewählten Einheiten reicht 1", () => {
    const six = ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"].map((d, i) =>
      gymF(d, i === 0 ? ["sprint", "prevention"] : ["strength"]),
    );
    const c6 = oc(build, {
      maxMainUnits: 6,
      allowances: dayAllowances({ ...input({ sessions: prev, availableWeekdays: [0, 1, 2, 3, 4, 5, 6], timeBudgetMin: 60 }), offseason: build }),
    });
    expect(validatePlan(six, c6).map((v) => v.code)).not.toContain("too_few_rest_days");
    const c5 = { ...c6, maxMainUnits: 5 };
    expect(validatePlan(six.slice(0, 5).concat(gymF("2026-12-06", ["strength"])), c5).map((v) => v.code)).toContain("too_few_rest_days");
  });

  it("Entlastungswoche: höchstens 70 % der Vergleichswoche", () => {
    const deload = { ...build, deload: true };
    // 1440 × 0,7 = 1008 AU. 4 × 60 × 6 = 1440 → zu viel; 4 × 40 × 6 = 960 → ok.
    expect(validatePlan(full, oc(deload)).map((v) => v.code)).toEqual(["deload_too_high"]);
    const light = full.map((u) => ({ ...u, durationMin: 40 }));
    expect(validatePlan(light, oc(deload)).map((v) => v.code)).toEqual([]);
  });

  it("enforcePlan räumt in der Off-Season 2 Ruhetage frei und hält die Entlastung ein", () => {
    const five = [...full, gymF("2026-12-06", ["mobility"])].map((u) => ({ ...u }));
    const c = oc({ ...build, deload: true }, {
      maxMainUnits: 5,
      allowances: dayAllowances({ ...input({ sessions: prev, availableWeekdays: [0, 1, 3, 5, 6] }), offseason: { ...build, deload: true } }),
    });
    const kept = enforcePlan(five, c);
    const codes = validatePlan(kept, c).map((v) => v.code);
    expect(codes).not.toContain("too_few_rest_days");
    expect(codes).not.toContain("deload_too_high");
  });
});
