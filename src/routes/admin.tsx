import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: Admin,
});

function Admin() {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        void navigate({ to: "/auth" });
        return;
      }

      const role =
        user.app_metadata?.role ??
        user.user_metadata?.role;

      if (role === "admin") {
        setAllowed(true);
      }

      setChecking(false);
    }

    void checkAdmin();
  }, [navigate]);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin" />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="max-w-md text-center">
          <Shield className="mx-auto mb-5 size-10 text-muted-foreground" />

          <h1 className="text-2xl font-bold">
            Admin access required
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your account doesn't have administrator permissions.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 py-10 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          NOVA / Operations
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Admin
        </h1>

        <p className="mt-3 max-w-2xl text-muted-foreground">
          Manage NOVA users, roles and football operations.
        </p>

        <div className="mt-10 border border-border bg-card p-8">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="size-5" />
            </div>

            <div>
              <h2 className="font-semibold">
                Administrator access
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                You are signed in as an administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
