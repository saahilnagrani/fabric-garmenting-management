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

/**
 * Layout for the fabric-custody PROTOTYPE routes.
 *
 * Identical chrome to the main (app) layout — same sidebar, topbar, providers
 * — plus a thin banner declaring "prototype mode". Reads real DB data via
 * Prisma; the new model concepts (FabricReceipt, GarmenterDispatch,
 * Allocation, Reservation) are synthesized from existing rows in
 * src/lib/proto/synthesize.ts. No writes to the DB happen from this tree.
 */
export default async function ProtoLayout({
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
          <div className="border-b bg-[oklch(0.98_0.025_45)] text-[oklch(0.40_0.16_45)] px-6 py-2 text-[12.5px] flex items-center gap-3">
            <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-[oklch(0.95_0.04_45)] border border-[oklch(0.85_0.06_45)]">
              prototype
            </span>
            <span>
              Fabric custody rework — visualizing the proposed model with real DB rows. <strong>No writes.</strong>
            </span>
          </div>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
        <Toaster closeButton richColors />
      </SidebarProvider>
    </Providers>
  );
}
