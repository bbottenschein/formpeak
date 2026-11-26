import Link from "next/link";
import { logout } from "@/features/auth/actions";
import type { CurrentUser } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";

/** Kopfzeile hinter dem Login. Die Tab-Leiste folgt mit den ersten Screens. */
export function AppHeader({ user }: { user: CurrentUser }) {
  const t = getT(user.locale);
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
      <Link href="/" className="text-lg font-extrabold tracking-tight">
        Form<span className="text-primary">Peak</span>
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/">{t("nav.today")}</Link>
        {user.role === "admin" && <Link href="/admin">{t("nav.admin")}</Link>}
        <form action={logout}>
          <button className="text-muted">{t("common.logout")}</button>
        </form>
      </nav>
    </header>
  );
}
