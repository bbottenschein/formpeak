import { getT } from "@/lib/i18n/server";
import { Wordmark } from "./wordmark";

/** Wortmarke mit Slogan für Login und Einladung. */
export function Brand({ className = "" }: { className?: string }) {
  const t = getT();
  return (
    <div className={`text-center ${className}`}>
      <h1>
        <Wordmark className="text-5xl" />
      </h1>
      <p className="eyebrow mt-2">{t("app.tagline")}</p>
    </div>
  );
}
