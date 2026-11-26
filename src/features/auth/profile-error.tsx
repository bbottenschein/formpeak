import { getT } from "@/lib/i18n/server";
import { logout } from "./actions";

/**
 * Angemeldet, aber kein lesbares Profil. Statt im Kreis umzuleiten,
 * zeigen wir den Fehler und bieten Abmelden an.
 */
export function ProfileError() {
  const t = getT();
  return (
    <div className="card text-center">
      <p className="font-semibold text-danger">{t("auth.profileErrorTitle")}</p>
      <p className="mt-2 text-sm text-muted">{t("auth.profileErrorText")}</p>
      <form action={logout} className="mt-4">
        <button className="btn-secondary w-full">{t("common.logout")}</button>
      </form>
    </div>
  );
}
