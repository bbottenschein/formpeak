import { getCurrentUser } from "@/features/auth/session";
import { AppHeader } from "@/features/shell/app-header";
import { TabBar } from "@/features/shell/tab-bar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await getCurrentUser();
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">{children}</main>
      <TabBar />
    </>
  );
}
