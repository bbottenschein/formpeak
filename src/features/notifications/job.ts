import "server-only";
import { zonedParts } from "@/lib/date";
import { getT } from "@/lib/i18n/server";
import { claimNotification, sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { dueReminders, type ReminderKind } from "./reminders";

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
    .select("id, timezone, locale, morning_reminder, evening_reminder, push_morning, push_evening")
    .in("id", userIds);
  if (error) throw error;

  let sent = 0;
  for (const p of profiles ?? []) {
    const { date, time } = zonedParts(now, p.timezone);
    const [{ data: checkins }, { data: log }] = await Promise.all([
      admin.from("checkins").select("kind").eq("user_id", p.id).eq("date", date),
      admin.from("notification_log").select("kind").eq("user_id", p.id).eq("ref", date),
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
      sent += await sendPush([p.id], {
        title: t(kind === "morning" ? "push.morningTitle" : "push.eveningTitle"),
        body: t(kind === "morning" ? "push.morningBody" : "push.eveningBody"),
        url: kind === "morning" ? "/checkin" : "/checkin/evening",
        tag: `checkin-${kind}`,
      });
    }
  }
  return { users: profiles?.length ?? 0, sent };
}
