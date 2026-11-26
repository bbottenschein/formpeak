import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Aktive Einwilligung zur Verarbeitung von Gesundheitsdaten (nicht widerrufen). */
export async function hasHealthConsent(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("consents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "health_data")
    .is("revoked_at", null);
  return (count ?? 0) > 0;
}
