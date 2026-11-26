import { runReminders } from "@/features/notifications/job";
import { isAuthorizedJob } from "@/lib/jobs";

export const maxDuration = 30;

/** Erinnerungen für Check-ins, alle 15 Minuten von pg_cron aufgerufen. */
export async function POST(request: Request) {
  if (!isAuthorizedJob(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await runReminders());
  } catch (error) {
    console.error("[reminders] fehlgeschlagen", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
