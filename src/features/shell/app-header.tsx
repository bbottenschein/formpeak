import Link from "next/link";
import { Wordmark } from "./wordmark";

/** Kopfzeile: nur die Wortmarke. Profil, Admin und Abmelden liegen im Tab „Profil“. */
export function AppHeader() {
  return (
    <header className="flex items-center border-b border-line px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <Link href="/">
        <Wordmark className="text-2xl" />
      </Link>
    </header>
  );
}
