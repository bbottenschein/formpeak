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
        <p className="eyebrow">{t("checkin.title")}</p>
        {existing && <p className="mt-1 text-sm text-muted">{t("checkin.editIntro")}</p>}
      </div>
      <MorningForm initial={values} />
    </section>
  );
}
