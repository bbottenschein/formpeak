"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

const TABS = [
  { href: "/", key: "nav.overview", match: (p: string) => p === "/" || p.startsWith("/checkin") || p.startsWith("/history") },
  { href: "/week", key: "nav.plan", match: (p: string) => p.startsWith("/week") || p.startsWith("/sessions") },
  {
    href: "/settings",
    key: "nav.profile",
    match: (p: string) =>
      p.startsWith("/settings") || p.startsWith("/calendar") || p.startsWith("/admin") || p.startsWith("/goals"),
  },
] as const;

/** Tab-Leiste unten: Übersicht (Hauptseite), Plan, Profil. Aktiver Tab in Limette. */
export function TabBar() {
  const t = useT();
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 border-t border-line bg-background pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-lg grid-cols-3">
        {TABS.map((tab) => {
          const active = tab.match(path);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-3 font-display text-sm font-semibold uppercase tracking-wider ${
                  active ? "text-primary" : "text-muted hover:text-foreground"
                }`}
              >
                <span className={`h-0.5 w-6 rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
