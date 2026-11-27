import "server-only";
import { addDays } from "@/core/load";
import { ensureFixtures, loadSessions } from "@/features/sessions/data";
import type { Translate } from "@/lib/i18n/translate";
import type { createClient } from "@/lib/supabase/server";
import { finalTestDate, goalOutcome, type GoalOutcome } from "./progress";
import type { GoalType } from "./schema";
import { lowerIsBetter, TEST_KEYS, type TestKey } from "./tests";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const GYM_TESTS: TestKey[] = ["squat_5rm", "bench_5rm"];
const RUN_TESTS: TestKey[] = ["sprint10", "sprint20", "yoyo_ir1", "run3k"];
/** Messungen ohne Training (Waage, Maßband) brauchen keine Einheit. */
const MEASURE_ONLY: TestKey[] = ["body_weight", "waist"];

/**
 * Abschlusstest: In der letzten Woche vor dem Zieldatum eine feste Einheit mit den Referenztests
 * (an einem Tag ohne Fußball) plus geplante Testtermine. Ersetzt einen früher geplanten Abschlusstest.
 */
export async function scheduleFinalTest(
  supabase: Supabase,
  userId: string,
  goalId: string,
  keys: TestKey[],
  targetDate: string | null,
  today: string,
  t: Translate,
) {
  const marker = `goal_test:${goalId}`;
  const { data: old } = await supabase.from("sessions").select("date").eq("user_id", userId).eq("rationale", marker).eq("status", "planned");
  await supabase.from("sessions").delete().eq("user_id", userId).eq("rationale", marker).eq("status", "planned");
  for (const o of old ?? []) {
    await supabase.from("goal_tests").delete().eq("goal_id", goalId).eq("status", "planned").eq("scheduled_for", o.date);
  }
  if (!targetDate || targetDate < today || keys.length === 0) return;

  const earliest = addDays(targetDate, -6) > today ? addDays(targetDate, -6) : today;
  await ensureFixtures(supabase, userId, addDays(earliest, -1), addDays(targetDate, 1));
  const rows = await loadSessions(supabase, userId, addDays(earliest, -1), addDays(targetDate, 1));
  // Kein Test an Fußballtagen und nicht direkt vor oder nach einem Spiel (frische Beine, kein Risiko).
  const fixtures = rows.filter((r) => r.is_fixture && r.status !== "cancelled");
  const busy = new Set([
    ...fixtures.map((r) => r.date),
    ...fixtures.filter((r) => r.type === "match").flatMap((r) => [addDays(r.date, -1), addDays(r.date, 1)]),
  ]);
  const date = finalTestDate(targetDate, busy, earliest);

  await supabase.from("goal_tests").insert(
    keys.map((k) => ({ user_id: userId, goal_id: goalId, test_key: k, status: "planned", scheduled_for: date })),
  );
  const trained = keys.filter((k) => !MEASURE_ONLY.includes(k));
  if (trained.length === 0) return;
  const type = trained.some((k) => GYM_TESTS.includes(k)) ? "gym" : trained.some((k) => RUN_TESTS.includes(k)) ? "run_intervals" : "mobility";
  const { data: session } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      date,
      type,
      status: "planned",
      is_fixture: false,
      duration_min: 25 + 10 * trained.length,
      target_rpe: 7,
      default_rpe: 7,
      gym_focus: type === "gym" ? "full" : null,
      planned_by: "rules",
      rationale: marker,
      title: t("goal.finalTestTitle"),
      focus: [],
    })
    .select("id")
    .single();
  if (!session) return;
  await supabase.from("planned_exercises").insert([
    { user_id: userId, session_id: session.id, position: 0, name: t("goal.finalWarmup"), prescription: "10 min", how: t("goal.finalWarmupHow"), measure: "time" },
    ...trained.map((k, i) => ({
      user_id: userId,
      session_id: session.id,
      position: i + 1,
      name: t(`goal.tests.${k}.name`),
      prescription: t("goal.finalBestOf"),
      how: t(`goal.tests.${k}.how`).slice(0, 300),
      measure: "check",
    })),
  ]);
}

/**
 * Ziel nach dem Zieldatum automatisch abschließen: Ergebnis aus den Referenztests bewerten
 * (geschafft / teilweise / nicht geschafft / offen) und archivieren.
 */
export async function archiveIfEnded(supabase: Supabase, userId: string, today: string): Promise<boolean> {
  const { data: goal } = await supabase
    .from("goals")
    .select("id, type, focuses, test_keys, targets, target_date")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (!goal?.target_date || goal.target_date >= today) return false;
  const outcome = await evaluateGoal(supabase, goal);
  await supabase.from("goals").update({ active: false, ended_on: goal.target_date, outcome }).eq("id", goal.id);
  // Offene Tests und der Abschlusstest entfallen.
  await supabase.from("goal_tests").update({ status: "skipped" }).eq("goal_id", goal.id).eq("status", "planned");
  await supabase.from("sessions").update({ status: "cancelled" }).eq("user_id", userId).eq("rationale", `goal_test:${goal.id}`).eq("status", "planned");
  return true;
}

interface GoalRow {
  id: string;
  type: string;
  focuses: string[] | null;
  test_keys: string[] | null;
  targets: Record<string, number> | null;
}

export async function evaluateGoal(supabase: Supabase, goal: GoalRow): Promise<GoalOutcome> {
  const { data: tests } = await supabase
    .from("goal_tests")
    .select("test_key, value, date")
    .eq("goal_id", goal.id)
    .eq("status", "done")
    .order("date");
  const keys = (goal.test_keys ?? []).filter((k): k is TestKey => (TEST_KEYS as readonly string[]).includes(k));
  return goalOutcome(
    keys.map((k) => ({
      values: (tests ?? []).filter((x) => x.test_key === k).map((x) => Number(x.value)),
      target: goal.targets?.[k] ?? null,
      lowerIsBetter: lowerIsBetter(k, (goal.focuses?.[0] ?? goal.type) as GoalType),
    })),
  );
}

export interface ArchivedGoal {
  id: string;
  focuses: GoalType[];
  description: string;
  startsOn: string | null;
  endedOn: string;
  outcome: GoalOutcome;
  tests: { key: TestKey; first: number | null; last: number | null }[];
}

/** Archivierte Ziele, neuestes zuerst, mit erstem und letztem Testwert. */
export async function getArchive(supabase: Supabase, userId: string): Promise<ArchivedGoal[]> {
  const { data: goals } = await supabase
    .from("goals")
    .select("id, type, focuses, test_keys, description, ai_summary, starts_on, created_at, ended_on, outcome")
    .eq("user_id", userId)
    .eq("active", false)
    .not("ended_on", "is", null)
    .order("ended_on", { ascending: false })
    .limit(20);
  if (!goals?.length) return [];
  const { data: tests } = await supabase
    .from("goal_tests")
    .select("goal_id, test_key, value, date")
    .in("goal_id", goals.map((g) => g.id))
    .eq("status", "done")
    .order("date");
  return goals.map((g) => {
    const keys = ((g.test_keys?.length ? g.test_keys : []) as TestKey[]).filter((k) => (TEST_KEYS as readonly string[]).includes(k));
    return {
      id: g.id,
      focuses: (g.focuses?.length ? g.focuses : [g.type]) as GoalType[],
      description: g.ai_summary || g.description || "",
      startsOn: g.starts_on ?? (g.created_at as string).slice(0, 10),
      endedOn: g.ended_on as string,
      outcome: (g.outcome ?? "open") as GoalOutcome,
      tests: keys.map((k) => {
        const values = (tests ?? []).filter((x) => x.goal_id === g.id && x.test_key === k).map((x) => Number(x.value));
        return { key: k, first: values[0] ?? null, last: values.length > 1 ? values[values.length - 1] : null };
      }),
    };
  });
}
