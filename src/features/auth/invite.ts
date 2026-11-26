"use server";

import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_VERSION, invitationStatus, validateInviteForm } from "./invite-logic";
import { findInvitation } from "./invite-queries";

export type InviteState = { error?: string; name?: string; email?: string };

/**
 * Löst eine Einladung ein: Konto anlegen (Secret Key, weil die öffentliche Registrierung
 * abgeschaltet ist), Einladung als eingelöst markieren, Einwilligung speichern, anmelden.
 */
export async function redeemInvite(
  code: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const t = getT();
  const form = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    consent: formData.get("consent") === "on",
  };
  const keep = { name: form.name, email: form.email };

  const invitation = await findInvitation(code);
  if (!invitation || invitationStatus(invitation) !== "open") {
    return { error: t("invite.invalid"), ...keep };
  }

  const problem = validateInviteForm(form, invitation);
  if (problem === "missing") return { error: t("invite.errorMissing"), ...keep };
  if (problem === "password") return { error: t("invite.errorPassword"), ...keep };
  if (problem === "emailMismatch") return { error: t("invite.errorEmailMismatch"), ...keep };

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: form.email,
    password: form.password,
    email_confirm: true,
    user_metadata: { name: form.name },
  });
  if (createError || !created.user) {
    const exists = createError?.code === "email_exists" || createError?.status === 422;
    if (!exists) console.error("[invite] Konto nicht angelegt", createError?.message);
    return { error: t(exists ? "invite.errorExists" : "invite.errorGeneric"), ...keep };
  }
  const userId = created.user.id;

  // Atomar einlösen: Nur wenn die Einladung in diesem Moment noch offen ist.
  const { data: redeemed, error: redeemError } = await admin
    .from("invitations")
    .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq("code", code)
    .is("redeemed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id");
  if (redeemError || !redeemed?.length) {
    await admin.auth.admin.deleteUser(userId);
    return { error: t("invite.invalid"), ...keep };
  }

  const { error: consentError } = await admin
    .from("consents")
    .insert({ user_id: userId, kind: "health_data", version: CONSENT_VERSION });
  if (consentError) console.error("[invite] Einwilligung nicht gespeichert", consentError.message);

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
  redirect("/");
}
