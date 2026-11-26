import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { EveningForm } from "@/features/checkin/evening-form";
import { getEveningFormData } from "@/features/checkin/queries";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Abend-Check-in" };

export default async function EveningCheckinPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const { values, existing } = await getEveningFormData(user.id, userToday(user.timezone));
  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{t("evening.title")}</p>
        {existing && <p className="mt-1 text-sm text-muted">{t("evening.editIntro")}</p>}
      </div>
      <EveningForm initial={values} />
    </section>
  );
}
