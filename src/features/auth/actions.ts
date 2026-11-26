"use server";

import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

// Die E-Mail wird zurückgegeben, weil React das Formular nach dem Absenden
// zurücksetzt – so muss sie nach einem Tippfehler nicht neu eingegeben werden.
export type LoginState = { error?: string; info?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const t = getT();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: t("auth.loginMissing"), email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: t("auth.loginFailed"), email };

  redirect("/");
}

/** Magic Link. Legt nie ein neues Konto an (Registrierung nur per Einladung). */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const t = getT();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: t("auth.magicLinkMissing"), email };

  const origin = await requestOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });
  // Unbekannte Adressen nicht verraten: immer dieselbe Rückmeldung.
  if (error && error.status !== 422 && error.status !== 400) {
    console.error("[auth] Magic Link fehlgeschlagen", error.message);
  }
  return { info: t("auth.magicLinkSent"), email };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
