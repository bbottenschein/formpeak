import Link from "next/link";
import { logout } from "@/features/auth/actions";
import type { CurrentUser } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Wordmark } from "./wordmark";

/** Kopfzeile hinter dem Login. Die Tab-Leiste folgt mit den ersten Screens. */
export function AppHeader({ user }: { user: CurrentUser }) {
  const t = getT(user.locale);
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
      <Link href="/">
        <Wordmark className="text-2xl" />
      </Link>
      <nav className="flex items-center gap-4 text-sm font-medium">
        <Link href="/" className="hover:text-primary">
          {t("nav.today")}
        </Link>
        <Link href="/checkin" className="hover:text-primary">
          {t("nav.checkin")}
        </Link>
        {user.role === "admin" && (
          <Link href="/admin" className="hover:text-primary">
            {t("nav.admin")}
          </Link>
        )}
        <form action={logout}>
          <button className="text-muted hover:text-foreground">{t("common.logout")}</button>
        </form>
      </nav>
    </header>
  );
}
