import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { hasHealthConsent } from "@/features/privacy/consent";
import { AppHeader } from "@/features/shell/app-header";
import { TabBar } from "@/features/shell/tab-bar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  // Ohne Einwilligung zur Verarbeitung von Gesundheitsdaten keine App (Art. 9 DSGVO).
  if (!(await hasHealthConsent(user.id))) redirect("/consent");
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">{children}</main>
      <TabBar />
    </>
  );
}
