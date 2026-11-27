import "server-only";
import { zonedParts } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { claimNotification, sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { dueFeedback, dueReminders, todayLine, type ReminderKind } from "./reminders";

/**
 * Erinnerungs-Job (alle 15 Minuten über pg_cron). Prüft für jeden Nutzer mit Push-Abo die
 * lokale Uhrzeit und schickt fällige Erinnerungen – jede höchstens einmal pro Tag.
 */
export async function runReminders(now: Date = new Date()) {
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("user_id");
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id as string))];
  if (userIds.length === 0) return { users: 0, sent: 0 };

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, timezone, locale, morning_reminder, evening_reminder, push_morning, push_evening, push_feedback")
    .in("id", userIds);
  if (error) throw error;

  let sent = 0;
  for (const p of profiles ?? []) {
    const { date, time } = zonedParts(now, p.timezone);
    const [{ data: checkins }, { data: log }, { data: sessions }, { data: feedbackLog }] = await Promise.all([
      admin.from("checkins").select("kind").eq("user_id", p.id).eq("date", date),
      admin.from("notification_log").select("kind").eq("user_id", p.id).eq("ref", date),
      admin
        .from("sessions")
        .select("id, date, type, start_time, duration_min, status, title, planned_by")
        .eq("user_id", p.id)
        .eq("date", date)
        .eq("status", "planned"),
      admin.from("notification_log").select("ref").eq("user_id", p.id).eq("kind", "feedback"),
    ]);
    const kinds = new Set((checkins ?? []).map((c) => c.kind));
    const due = dueReminders(
      {
        morningReminder: p.morning_reminder,
        eveningReminder: p.evening_reminder,
        pushMorning: p.push_morning,
        pushEvening: p.push_evening,
      },
      {
        localTime: time,
        morningDone: kinds.has("morning"),
        eveningDone: kinds.has("evening"),
        alreadySent: new Set((log ?? []).map((l) => l.kind as ReminderKind)),
      },
    );

    const t = getT(p.locale);
    for (const kind of due) {
      if (!(await claimNotification(p.id, kind, date))) continue;
      // Morgens mit dem Plan des Tages: „Heute: Kraft Unterkörper · 50 min“ – ein Grund, die App zu öffnen.
      const line = todayLine(
        (sessions ?? []).map((x) => ({
          type: x.type,
          title: x.planned_by === "user" ? null : x.title,
          durationMin: x.duration_min,
          startTime: x.start_time,
        })),
        (type) => t(`sessionTypes.${type as "training"}`),
      );
      const morningBody =
        line.length > 0
          ? t("push.morningPlan", { plan: line.map((l) => `${l.label} · ${l.detail}`).join(", ") })
          : t("push.morningRest");
      sent += await sendPush([p.id], {
        title: t(kind === "morning" ? "push.morningTitle" : "push.eveningTitle"),
        body: kind === "morning" ? morningBody : t("push.eveningBody"),
        url: kind === "morning" ? "/checkin" : "/checkin/evening",
        tag: `checkin-${kind}`,
      });
    }

    if (!p.push_feedback) continue;
    const due_ = dueFeedback(
      (sessions ?? []).map((x) => ({
        id: x.id,
        date: x.date,
        startTime: x.start_time,
        durationMin: x.duration_min,
        status: x.status,
      })),
      date,
      time,
      new Set((feedbackLog ?? []).map((l) => l.ref as string)),
    );
    for (const s of due_) {
      if (!(await claimNotification(p.id, "feedback", s.id))) continue;
      const type = (sessions ?? []).find((x) => x.id === s.id)?.type ?? "training";
      sent += await sendPush([p.id], {
        title: t("push.feedbackTitle"),
        body: t("push.feedbackBody", { type: t(`sessionTypes.${type as "training"}`) }),
        url: `/sessions/${s.id}`,
        tag: `feedback-${s.id}`,
      });
    }
  }
  return { users: profiles?.length ?? 0, sent };
}
