import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/leagues")({
  component: Leagues,
});

type League = {
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
};

function Leagues() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLeagues() {
      const { data, error } = await supabase
        .from("leagues")
        .select("id,name,slug,status")
        .order("name", { ascending: true });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setLeagues((data ?? []) as League[]);
      setLoading(false);
    }

    void loadLeagues();
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Leagues</h1>
          <p className="mt-2 text-muted-foreground">
            Browse every NOVA league.
          </p>
        </div>

        {loading && (
          <div className="rounded-xl border border-border bg-card p-6">
            Loading leagues...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-card p-6 text-destructive">
            Failed to load leagues: {error}
          </div>
        )}

        {!loading && !error && leagues.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
            No leagues have been created yet.
          </div>
        )}

        {!loading && !error && leagues.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => (
              <div
                key={league.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">{league.name}</h2>

                  {league.status && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {league.status}
                    </p>
                  )}
                </div>

                <a
                  href={`/leagues/${league.id}`}
                  className="inline-flex rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-85"
                >
                  View League
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
