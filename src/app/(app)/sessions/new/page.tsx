import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { NewSessionForm } from "@/features/sessions/new-session-form";
import { userToday } from "@/lib/date";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Einheit planen" };

export default async function NewSessionPage({ searchParams }: PageProps<"/sessions/new">) {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  const { date, fixture } = await searchParams;
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : userToday(user.timezone);
  const isFixture = fixture === "1";

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">{isFixture ? t("session.newFixtureTitle") : t("session.newTitle")}</h1>
      <NewSessionForm date={day} fixture={isFixture} />
    </section>
  );
}
