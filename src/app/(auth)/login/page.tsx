"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Soft theme-aware background gradient. Uses semi-transparent primary
          tint so it adapts cleanly to light, dark, dim, and cool-dark. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10"
      />
      {/* Subtle radial highlight behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        {/* Brand mark above the card */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Hyperballik
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Inventory &amp; Operations
          </p>
        </div>

        {/* Login card — theme-aware, properly bordered, with real elevation */}
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-2xl shadow-black/10 dark:shadow-black/40">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-base font-semibold">Sign in</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter your credentials to access the dashboard.
            </p>
          </div>
          <div className="px-6 pb-6">
            {/* method="POST" is defense-in-depth: if React fails to hydrate
                for any reason, the browser's native form submission falls
                back to POST instead of GET, so credentials never end up in
                the URL or server access logs. */}
            <form
              onSubmit={handleSubmit}
              method="POST"
              action="#"
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@hyperballik.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && (
                <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Authorised access only. All activity is logged.
        </p>
      </div>
    </div>
  );
}
