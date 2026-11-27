import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/session";
import { SOURCES } from "@/features/sources/sources";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Quellen" };

/** Quellen mit Titel, Jahr, Link und zwei Sätzen Zusammenfassung. */
export default async function SourcesPage() {
  const user = await getCurrentUser();
  const t = getT(user.locale);
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-4xl font-bold">{t("sources.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("sources.intro")}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {SOURCES.map((s) => (
          <li key={s.key} id={s.key} className="card flex flex-col gap-1.5">
            <p className="text-xs text-muted">
              {t(`sources.items.${s.key}.authors`)} · {t(`sources.items.${s.key}.journal`)} · {t(`sources.items.${s.key}.year`)}
            </p>
            <p className="font-medium leading-snug">{t(`sources.items.${s.key}.title`)}</p>
            <p className="text-sm text-muted">{t(`sources.items.${s.key}.summary`)}</p>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="self-start text-sm underline underline-offset-4">
              {t("sources.open")}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
