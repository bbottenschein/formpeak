"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { CONSENT_VERSION } from "@/features/auth/invite-logic";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PrivacyState = { error?: string };

/** Einwilligung nachholen (Konten, die vor dem Einwilligungs-Schritt angelegt wurden). */
export async function giveConsent(): Promise<PrivacyState> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("consents")
    .insert({ user_id: user.id, kind: "health_data", version: CONSENT_VERSION });
  if (error) {
    console.error("[consent] nicht gespeichert", error.message);
    return { error: getT(user.locale)("consent.error") };
  }
  redirect("/");
}

/**
 * Konto mit allen Daten löschen. Alle Nutzertabellen hängen per `on delete cascade` am Profil,
 * das Profil am Auth-Konto. Braucht den Secret Key, weil Nutzer ihr Auth-Konto nicht selbst löschen dürfen.
 */
export async function deleteAccount(_prev: PrivacyState, formData: FormData): Promise<PrivacyState> {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  if (String(formData.get("confirm") ?? "").trim() !== t("privacy.deleteConfirmWord")) {
    return { error: t("privacy.deleteWrong") };
  }
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[privacy] Konto nicht gelöscht", error.message);
    return { error: t("privacy.deleteFailed") };
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
