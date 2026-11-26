import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { MorningForm } from "@/features/checkin/morning-form";
import { getMorningFormData } from "@/features/checkin/queries";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Check-in" };

export default async function CheckinPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const { values, existing } = await getMorningFormData(user.id, userToday(user.timezone));

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold">{t("checkin.title")}</h1>
        <p className="mt-1 text-sm text-muted">{existing ? t("checkin.editIntro") : t("checkin.intro")}</p>
      </div>
      <MorningForm initial={values} />
    </section>
  );
}
