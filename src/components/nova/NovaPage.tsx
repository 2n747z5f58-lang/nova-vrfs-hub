import { Link } from "@tanstack/react-router";
import { ArrowLeft, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NovaHeader, NovaSidebar } from "@/components/nova/NovaSidebar";

type NovaPageProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  emptyTitle: string;
  emptyText: string;
  detail?: boolean;
};

export function NovaPage({
  title,
  eyebrow,
  description,
  emptyTitle,
  emptyText,
  detail,
}: NovaPageProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [displayName, setDisplayName] = useState("Football");

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (data?.display_name) {
        setDisplayName(data.display_name);
      }
    }

    void loadProfile();
  }, []);

  return (
    <div className="nova-page min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <NovaSidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <div className="min-w-0 flex-1">
          <NovaHeader onMenu={() => setMobileOpen(true)} />

          <main
            id="main"
            className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10"
          >
            <div className="mb-8">
              <p className="text-sm font-medium text-muted-foreground">
                Good evening,
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight">
                {displayName}
              </h1>
            </div>

            <Link
              to="/"
              className="mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3" />
              Back to overview
            </Link>

            <div className="mb-10 max-w-3xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {eyebrow ?? "NOVA / Platform"}
              </p>

              <h2 className="text-4xl font-bold tracking-[-0.04em] md:text-5xl">
                {title}
              </h2>

              {description && (
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  {description}
                </p>
              )}
            </div>

            {detail ? (
              <div className="border border-border bg-card">
                <div className="border-b border-border p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Record detail
                  </p>

                  <h2 className="mt-2 text-xl font-semibold">
                    No record selected
                  </h2>
                </div>

                <Empty title={emptyTitle} text={emptyText} />
              </div>
            ) : (
              <div className="border border-border bg-card">
                <Empty title={emptyTitle} text={emptyText} />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Empty({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-5 grid size-14 place-items-center border border-dashed border-border text-muted-foreground">
        <Inbox className="size-5" />
      </div>

      <h2 className="text-lg font-semibold">{title}</h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
