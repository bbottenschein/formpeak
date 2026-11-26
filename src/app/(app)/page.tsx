import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { LightCard } from "@/features/today/light-card";
import { computeMetricsFor } from "@/features/today/metrics";
import { PainList } from "@/features/today/pain-list";
import { formatLongDate, userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";

export default async function TodayPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const today = userToday(user.timezone);
  // Immer frisch berechnen: Die Ampel hängt vom heutigen Datum und allen Daten bis heute ab.
  const metrics = await computeMetricsFor(user.id, today, today);
  const hasCheckin = metrics.readiness != null;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <p className="eyebrow">{formatLongDate(today)}</p>
        <h1 className="text-4xl font-bold">{t("today.greeting", { name: user.name })}</h1>
      </div>

      {hasCheckin ? (
        <>
          <LightCard metrics={metrics} t={t} />
          <PainList spots={metrics.painSpots} t={t} />
          <Link href="/checkin" className="btn-secondary text-center">
            {t("today.checkinEdit")}
          </Link>
        </>
      ) : (
        <div className="card flex flex-col gap-4">
          <p className="text-muted">{t("today.noCheckin")}</p>
          <PainList spots={metrics.painSpots} t={t} />
          <Link href="/checkin" className="btn-primary text-center">
            {t("today.checkinCta")}
          </Link>
        </div>
      )}
    </section>
  );
}
