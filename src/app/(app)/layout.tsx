import { getCurrentUser } from "@/features/auth/session";
import { AppHeader } from "@/features/shell/app-header";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">{children}</main>
    </>
  );
}
