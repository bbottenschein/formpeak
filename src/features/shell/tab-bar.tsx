"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

type Tab = { href: string; key: "nav.home" | "nav.today" | "nav.log" | "nav.goal" | "nav.calendar"; match: (p: string) => boolean };

const TABS: Tab[] = [
  { href: "/", key: "nav.home", match: (p) => p === "/" || p.startsWith("/score") || p.startsWith("/history") || p.startsWith("/sources") },
  { href: "/today", key: "nav.today", match: (p) => p.startsWith("/today") },
  { href: "/log", key: "nav.log", match: (p) => p.startsWith("/log") || p.startsWith("/checkin") },
  { href: "/goals", key: "nav.goal", match: (p) => p.startsWith("/goals") },
  { href: "/week", key: "nav.calendar", match: (p) => p.startsWith("/week") || p.startsWith("/sessions") || p.startsWith("/calendar") },
];

/**
 * Fünf Bereiche (docs/KONZEPT.md): Home · Heute · + Erfassen · Ziel · Kalender.
 * Jeder beantwortet genau eine Frage. Aktiver Bereich in Limette, „+“ als runder Button.
 */
export function TabBar() {
  const t = useT();
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 border-t border-line bg-background pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-center">
        {TABS.map((tab) => {
          const active = tab.match(path);
          if (tab.key === "nav.log") {
            return (
              <li key={tab.href} className="flex justify-center">
                <Link
                  href={tab.href}
                  aria-label={t(tab.key)}
                  aria-current={active ? "page" : undefined}
                  className="my-1.5 flex size-12 items-center justify-center rounded-full bg-primary font-display text-3xl font-bold leading-none text-primary-foreground"
                >
                  +
                </Link>
              </li>
            );
          }
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-3 font-display text-xs font-semibold uppercase tracking-wider ${
                  active ? "text-primary" : "text-muted hover:text-foreground"
                }`}
              >
                <span className={`h-0.5 w-5 rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
