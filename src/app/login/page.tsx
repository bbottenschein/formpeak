import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";
import { ProfileError } from "@/features/auth/profile-error";
import { Brand } from "@/features/shell/brand";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const t = getT();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <Brand className="mb-10" />
      {error === "profile" ? (
        <ProfileError />
      ) : (
        <>
          <LoginForm initialError={error === "link" ? t("auth.callbackFailed") : undefined} />
          <p className="mt-8 text-center text-xs text-muted">{t("auth.inviteOnly")}</p>
        </>
      )}
    </main>
  );
}
