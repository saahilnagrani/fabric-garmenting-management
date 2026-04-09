import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { SourcingSidebar } from "@/components/layout/sourcing-sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";

export default async function SourcingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <Providers>
      <SidebarProvider>
        <SourcingSidebar />
        <SidebarInset>
          <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="ml-auto">
              <UserMenu userName={session?.user?.name} />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </Providers>
  );
}
