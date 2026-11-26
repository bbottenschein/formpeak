import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvitationRow } from "./invite-logic";

/**
 * Einladung zum Code. Läuft mit dem Secret Key, weil Eingeladene noch kein Konto haben
 * und Einladungen per RLS nur für den Admin lesbar sind. Liefert nur die nötigen Felder.
 */
export async function findInvitation(code: string): Promise<InvitationRow | null> {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(code)) return null;
  const { data, error } = await createAdminClient()
    .from("invitations")
    .select("code, email, expires_at, redeemed_at")
    .eq("code", code)
    .maybeSingle();
  if (error) console.error("[invite] Einladung nicht lesbar", error.message);
  return data ?? null;
}
