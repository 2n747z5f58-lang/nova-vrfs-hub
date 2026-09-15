import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type League = {
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
};

type Division = {
  id: string;
  league_id: string;
  name: string;
  tier: number | null;
  status: string | null;
};

export const Route = createFileRoute("/leagues")({
  component: Leagues,
});

function Leagues() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadLeagues();
  }, []);

  async function loadLeagues() {
    setLoading(true);
    setError(null);

    const [leagueResponse, divisionResponse] = await Promise.all([
      supabase
        .from("leagues")
        .select("id,name,slug,status")
        .order("name", { ascending: true }),

      supabase
        .from("divisions")
        .select("id,league_id,name,tier,status")
        .order("tier", { ascending: true }),
    ]);

    if (leagueResponse.error) {
      console.error("Failed to load leagues:", leagueResponse.error);
      setError("Couldn't load leagues.");
      setLoading(false);
      return;
    }

    if (divisionResponse.error) {
      console.error(
        "Failed to load divisions:",
        divisionResponse.error,
      );
      setError("Couldn't load league tiers.");
      setLoading(false);
      return;
    }

    setLeagues((leagueResponse.data ?? []) as League[]);
    setDivisions((divisionResponse.data ?? []) as Division[]);
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

  function getLeagueDivisions(leagueId: string) {
    return divisions
      .filter((division) => division.league_id === leagueId)
      .sort((a, b) => {
        if (a.tier === null) return 1;
        if (b.tier === null) return -1;
        return a.tier - b.tier;
      });
  }

  function getTierLabel(leagueId: string) {
    const leagueDivisions = getLeagueDivisions(leagueId);

    if (leagueDivisions.length === 0) {
      return "No tier";
    }

    const tiers = leagueDivisions
      .map((division) => division.tier)
      .filter((tier): tier is number => tier !== null);

    if (tiers.length === 0) {
      return "No tier";
    }

    const uniqueTiers = [...new Set(tiers)];

    if (uniqueTiers.length === 1) {
      return `Tier ${uniqueTiers[0]}`;
    }

    return `Tiers ${Math.min(...uniqueTiers)}-${Math.max(...uniqueTiers)}`;
  }

  function openLeague(leagueId: string) {
    window.location.assign(`/leagues/${leagueId}`);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading leagues...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
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
            {filteredLeagues.map((league) => {
              const leagueDivisions = getLeagueDivisions(league.id);

              return (
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

                    <span className="shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {getTierLabel(league.id)}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {leagueDivisions.length === 0
                        ? "No divisions"
                        : `${leagueDivisions.length} ${
                            leagueDivisions.length === 1
                              ? "division"
                              : "divisions"
                          }`}
                    </div>

                    <button
                      type="button"
                      onClick={() => openLeague(league.id)}
                      className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-85"
                    >
                      View League
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
