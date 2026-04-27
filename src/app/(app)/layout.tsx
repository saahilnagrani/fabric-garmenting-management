import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { Providers } from "@/components/providers";
import { ReloadDebug } from "@/components/reload-debug";
import { Toaster } from "sonner";
import { getPhases } from "@/actions/phases";
import { getDashboardAlerts, type DashboardAlert } from "@/actions/dashboard";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  let phases: Awaited<ReturnType<typeof getPhases>> = [];
  let alerts: DashboardAlert[] = [];
  try {
    phases = await getPhases();
    const currentPhase = phases.find((p) => p.isCurrent);
    if (currentPhase) {
      alerts = await getDashboardAlerts(currentPhase.id);
    }
  } catch {
    // User may not have permission or session may be stale
  }

  return (
    <Providers>
      <ReloadDebug />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <TopBar phases={phases} userName={session?.user?.name} alerts={alerts} />
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
        <Toaster closeButton richColors />
      </SidebarProvider>
    </Providers>
  );
}
