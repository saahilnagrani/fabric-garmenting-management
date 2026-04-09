import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import { getPhases } from "@/actions/phases";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  let phases: Awaited<ReturnType<typeof getPhases>> = [];
  try {
    phases = await getPhases();
  } catch {
    // User may not have permission or session may be stale
  }

  return (
    <Providers>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <TopBar phases={phases} userName={session?.user?.name} />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </SidebarInset>
        <Toaster closeButton richColors />
      </SidebarProvider>
    </Providers>
  );
}
