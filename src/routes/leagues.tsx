import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
type League = {
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
};
export const Route = createFileRoute("/leagues")({
  component: Leagues,
});
function Leagues() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    loadLeagues();
  }, []);
  async function loadLeagues() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("leagues")
      .select("id,name,slug,status")
      .order("name", { ascending: true });
    if (error) {
      console.error("Failed to load leagues:", error);
      setError("Couldn't load leagues.");
      setLoading(false);
      return;
    }
    setLeagues(data ?? []);
    setLoading(false);
  }
  const filteredLeagues = leagues.filter((league) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return (
      league.name.toLowerCase().includes(query) ||
      league.slug?.toLowerCase().includes(query)
    );
  });
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading leagues...
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Competition index
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Leagues
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse leagues connected to NOVA.
          </p>
        </div>
        <div className="mb-6">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search leagues..."
            className="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
          />
        </div>
        {filteredLeagues.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">
              {search ? "No leagues found" : "No leagues yet"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "Try a different league name."
                : "Leagues created in NOVA will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLeagues.map((league) => (
              <div
                key={league.id}
                className="rounded-xl border bg-card p-5 transition hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">
                      {league.name}
                    </h2>
                    {league.slug && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {league.slug}
                      </p>
                    )}
                  </div>
                  {league.status && (
                    <span className="shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {league.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
