import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton({ userName }: { userName?: string | null }) {
  return (
    <div className="flex items-center gap-3">
      {userName && (
        <span className="text-sm text-muted-foreground">{userName}</span>
      )}
      <form
        action={async () => {
          "use server";
          await signOut({ redirect: true, redirectTo: "/login" });
        }}
      >
        <Button variant="ghost" size="icon" type="submit" title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
