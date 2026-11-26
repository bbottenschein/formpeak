import { getT } from "@/lib/i18n/server";

/** Schriftzug mit Slogan für Login und Einladung. */
export function Brand({ className = "" }: { className?: string }) {
  const t = getT();
  return (
    <div className={`text-center ${className}`}>
      <h1 className="text-3xl font-extrabold tracking-tight">
        Form<span className="text-primary">Peak</span>
      </h1>
      <p className="mt-1 font-medium text-muted">{t("app.tagline")}</p>
    </div>
  );
}
