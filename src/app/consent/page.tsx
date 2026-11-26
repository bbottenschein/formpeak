import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { hasHealthConsent } from "@/features/privacy/consent";
import { ConsentForm } from "@/features/privacy/consent-form";
import { Brand } from "@/features/shell/brand";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Einwilligung" };

export default async function ConsentPage() {
  const user = await getCurrentUser();
  if (await hasHealthConsent(user.id)) redirect("/");
  const t = getT(user.locale);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 pb-12 pt-[calc(env(safe-area-inset-top)+3rem)]">
      <Brand className="mb-8" />
      <h2 className="text-3xl font-bold">{t("consent.title")}</h2>
      <p className="mb-5 mt-1 text-sm text-muted">{t("consent.intro")}</p>
      <ConsentForm />
    </main>
  );
}
