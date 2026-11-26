import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "user" | "admin";

export type CurrentUser = {
  id: string;
  name: string;
  role: Role;
  timezone: string;
  locale: string;
};

/**
 * Data Access Layer: angemeldeter Nutzer samt Profil.
 * Pro Request nur einmal ausgeführt (React cache).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, timezone, locale")
    .eq("id", userId)
    .maybeSingle();

  if (error) console.error("[auth] Profil nicht lesbar", error);
  if (!profile) redirect("/login?error=profile");

  return {
    id: profile.id,
    name: profile.display_name,
    role: profile.role as Role,
    timezone: profile.timezone,
    locale: profile.locale,
  };
});

/** Für Seiten, die nur der Admin sehen darf. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
