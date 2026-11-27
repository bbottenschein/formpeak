import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { Wordmark } from "./wordmark";

/** Kopfzeile: Wortmarke links, Profil (Einstellungen, Datenschutz, Abmelden) rechts. */
export function AppHeader() {
  const t = getT();
  return (
    <header className="flex items-center justify-between border-b border-line px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <Link href="/">
        <Wordmark className="text-2xl" />
      </Link>
      <Link
        href="/settings"
        aria-label={t("header.profile")}
        className="flex size-9 items-center justify-center rounded-full border border-line text-muted hover:border-primary hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" strokeLinecap="round" />
        </svg>
      </Link>
    </header>
  );
}
