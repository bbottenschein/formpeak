import type { Metadata } from "next";
import { InviteCreator } from "@/features/admin/invite-creator";
import { InviteList } from "@/features/admin/invite-list";
import { requireAdmin } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  const t = getT(admin.locale);
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold">{t("admin.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("admin.intro")}</p>
      </div>
      <InviteCreator />
      <InviteList />
    </section>
  );
}
