import { auth, signOut } from "@/lib/auth";
import { getPhases } from "@/actions/phases";
import { PhaseSelector } from "./phase-selector";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LogOut } from "lucide-react";

export async function TopBar() {
  const session = await auth();
  const phases = await getPhases();
  const currentPhase = phases.find((p) => p.isCurrent);

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <PhaseSelector
        phases={phases}
        currentPhaseId={currentPhase?.id}
      />
      <div className="ml-auto flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {session?.user?.name}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="ghost" size="icon" type="submit">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
