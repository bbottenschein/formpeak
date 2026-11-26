import { getCurrentUser } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { formatLongDate, userToday } from "@/lib/date";

// Platzhalter für den Heute-Screen (Build-Schritt 5, siehe SPEC.md).
export default async function TodayPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-muted">{formatLongDate(userToday(user.timezone))}</p>
      <h1 className="text-2xl font-bold">{t("today.greeting", { name: user.name })}</h1>
      <p className="card mt-4 text-sm text-muted">{t("today.placeholder")}</p>
    </section>
  );
}
