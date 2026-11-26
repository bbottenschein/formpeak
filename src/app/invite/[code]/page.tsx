import type { Metadata } from "next";
import { InviteForm } from "@/features/auth/invite-form";
import { invitationStatus } from "@/features/auth/invite-logic";
import { findInvitation } from "@/features/auth/invite-queries";
import { Brand } from "@/features/shell/brand";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Einladung" };

export default async function InvitePage({ params }: PageProps<"/invite/[code]">) {
  const { code } = await params;
  const t = getT();
  const invitation = await findInvitation(code);
  const open = invitation != null && invitationStatus(invitation) === "open";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <Brand className="mb-8" />
      {open ? (
        <>
          <h2 className="text-xl font-bold">{t("invite.title")}</h2>
          <p className="mb-6 mt-1 text-sm text-muted">{t("invite.intro")}</p>
          <InviteForm code={code} presetEmail={invitation.email} />
        </>
      ) : (
        <p className="card text-center text-sm">{t("invite.invalid")}</p>
      )}
    </main>
  );
}
