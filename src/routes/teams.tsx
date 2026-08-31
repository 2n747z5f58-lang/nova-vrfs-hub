import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
type Team = {
  id: string;
  name: string;
  logo_url: string | null;
  division_id: string | null;
  division?: {
    id: string;
    name: string;
  } | null;
};
export const Route = createFileRoute("/teams")({
  component: Teams,
});
function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    loadTeams();
  }, []);
  async function loadTeams() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("teams")
      .select(`
        id,
        name,
        logo_url,
        division_id,
        division:divisions (
          id,
          name
        )
      `)
      .order("name", { ascending: true });
    if (error) {
      console.error("Failed to load teams:", error);
      setError("Couldn't load teams.");
      setLoading(false);
      return;
    }
    setTeams((data ?? []) as Team[]);
    setLoading(false);
  }
  const filteredTeams = teams.filter((team) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return (
      team.name.toLowerCase().includes(query) ||
      team.division?.name?.toLowerCase().includes(query)
    );
  });
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading teams...
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
            Club directory
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Teams
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Find registered VRFS teams and their divisions.
          </p>
        </div>
        <div className="mb-6">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search teams or divisions..."
            className="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
          />
        </div>
        {filteredTeams.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">
              {search ? "No teams found" : "No teams registered"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "Try a different team or division."
                : "Teams will appear here once they are registered in NOVA."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className="rounded-xl border bg-card p-4 transition hover:bg-accent/40"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background">
                    {team.logo_url ? (
                      <img
                        src={team.logo_url}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">
                        {team.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">
                      {team.name}
                    </h2>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {team.division?.name ?? "Division not assigned"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-t pt-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Registered NOVA team
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
