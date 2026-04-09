import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import {
  Package,
  Search,
  ArrowRight,
  Shield,
} from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { Providers } from "@/components/providers";
import { hasInventoryAccess, hasSourcingAccess } from "@/lib/permissions";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user?.role === "ADMIN";
  const permCtx = {
    role: session.user?.role ?? "USER",
    inventoryRole: session.user?.inventoryRole,
    sourcingRole: session.user?.sourcingRole,
    permissionOverrides: session.user?.permissionOverrides,
  };

  return (
    <Providers>
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-end gap-4 border-b bg-background px-6">
        <UserMenu userName={session?.user?.name} />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Hyperballik</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Select a tool to get started
          </p>
        </div>

        <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {hasInventoryAccess(permCtx) && (
            <Link
              href="/dashboard"
              className="group relative flex flex-col border bg-card p-8 shadow-sm transition-all hover:shadow-md hover:border-accent"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center bg-accent/10">
                <Package className="h-6 w-6 text-accent" />
              </div>
              <h2 className="text-xl font-semibold">Fabric & Garmenting</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Manage product orders, fabric procurement, expenses, vendors, and
                phase planning for garment production.
              </p>
              <div className="mt-6 flex items-center gap-1 text-sm font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                Open <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          )}

          {hasSourcingAccess(permCtx) && (
            <Link
              href="/sourcing/dashboard"
              className="group relative flex flex-col border bg-card p-8 shadow-sm transition-all hover:shadow-md hover:border-accent"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center bg-accent/10">
                <Search className="h-6 w-6 text-accent" />
              </div>
              <h2 className="text-xl font-semibold">Sourcing Agent</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Discover suppliers with AI-powered web search, manage your pipeline,
                and generate outreach emails.
              </p>
              <div className="mt-6 flex items-center gap-1 text-sm font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                Open <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/admin/users"
              className="group relative flex flex-col border bg-card p-8 shadow-sm transition-all hover:shadow-md hover:border-accent"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center bg-accent/10">
                <Shield className="h-6 w-6 text-accent" />
              </div>
              <h2 className="text-xl font-semibold">Admin</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Manage users, roles, and permissions across all modules.
              </p>
              <div className="mt-6 flex items-center gap-1 text-sm font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                Open <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
    </Providers>
  );
}
