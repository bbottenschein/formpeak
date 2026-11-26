import { requireAdmin } from "@/features/auth/session";
import { invitationStatus } from "@/features/auth/invite-logic";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const formatDate = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone }).format(new Date(iso));

/** Letzte Einladungen mit Status. Nur für den Admin (RLS). */
export async function InviteList() {
  const admin = await requireAdmin();
  const t = getT(admin.locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select("id, code, email, note, expires_at, redeemed_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="eyebrow">{t("admin.list")}</h2>
      {!data?.length && <p className="text-sm text-muted">{t("admin.empty")}</p>}
      <ul className="flex flex-col divide-y divide-line">
        {data?.map((inv) => {
          const status = invitationStatus(inv);
          return (
            <li key={inv.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">{inv.note || inv.email || "–"}</span>
              <span className="shrink-0 text-muted">
                {status === "open" && t("admin.statusOpen", { date: formatDate(inv.expires_at, admin.timezone) })}
                {status === "redeemed" &&
                  t("admin.statusRedeemed", { date: formatDate(inv.redeemed_at!, admin.timezone) })}
                {status === "expired" && t("admin.statusExpired")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
