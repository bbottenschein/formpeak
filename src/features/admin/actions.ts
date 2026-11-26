"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/session";
import { generateInviteCode } from "@/features/auth/invite-logic";
import { getT } from "@/lib/i18n/server";
import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export type CreateInviteState = { error?: string; link?: string };

/** Erzeugt eine Einladung. Läuft mit dem Nutzer-Token; RLS erlaubt das nur dem Admin. */
export async function createInvitation(
  _prev: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  const admin = await requireAdmin();
  const t = getT(admin.locale);
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const note = String(formData.get("note") ?? "").trim();
  const code = generateInviteCode();

  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .insert({ code, email, note, created_by: admin.id });
  if (error) {
    console.error("[admin] Einladung nicht angelegt", error.message);
    return { error: t("admin.error") };
  }

  revalidatePath("/admin");
  return { link: `${await requestOrigin()}/invite/${code}` };
}
