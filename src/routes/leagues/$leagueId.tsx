import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
type League = {
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
};
type Division = {
  id: string;
  name: string;
  league_id: string;
  season: string | null;
};
type Standing = {
  id: string;
  division_id: string;
  team_id: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  team?: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
};
export const Route = createFileRoute("/leagues/$leagueId")({
  component: LeagueDetail,
});
function LeagueDetail() {
  const { leagueId } = Route.useParams();
  const [league, setLeague] = useState<League | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    async function loadLeague() {
      setLoading(true);
      setError("");
      const { data: leagueData, error: leagueError } = await supabase
        .from("leagues")
        .select("id,name,slug,status")
        .eq("id", leagueId)
        .maybeSingle();
      if (leagueError) {
        console.error("Failed to load league:", leagueError);
        setError("Couldn't load this league.");
        setLoading(false);
        return;
      }
      if (!leagueData) {
        setError("League not found.");
        setLoading(false);
        return;
      }
      setLeague(leagueData);
      const { data: divisionData, error: divisionError } = await supabase
        .from("divisions")
        .select("id,name,league_id,season")
        .eq("league_id", leagueId)
        .order("name", { ascending: true });
      if (divisionError) {
        console.error("Failed to load divisions:", divisionError);
        setError("Couldn't load the divisions for this league.");
        setLoading(false);
        return;
      }
      const loadedDivisions = (divisionData ?? []) as Division[];
      setDivisions(loadedDivisions);
      if (loadedDivisions.length === 0) {
        setStandings([]);
        setLoading(false);
        return;
      }
      const divisionIds = loadedDivisions.map((division) => division.id);
      const { data: standingData, error: standingError } = await supabase
        .from("standings")
        .select(
          `
            id,
            division_id,
            team_id,
            played,
            wins,
            draws,
            losses,
            goals_for,
            goals_against,
            goal_difference,
            points,
            team:teams (
              id,
              name,
              logo_url
            )
          `,
        )
        .in("division_id", divisionIds)
        .order("points", { ascending: false })
        .order("goal_difference", { ascending: false })
        .order("goals_for", { ascending: false });
      if (standingError) {
        console.error("Failed to load standings:", standingError);
        setError("Couldn't load the league standings.");
        setLoading(false);
        return;
      }
      setStandings((standingData ?? []) as Standing[]);
      setLoading(false);
    }
    void loadLeague();
  }, [leagueId]);
  const standingsByDivision = useMemo(() => {
    return divisions.map((division) => ({
      division,
      rows: standings.filter(
        (standing) => standing.division_id === division.id,
      ),
    }));
  }, [divisions, standings]);
  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Loading league...
          </p>
        </div>
      </main>
    );
  }
  if (error || !league) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center text-center">
          <div>
            <h1 className="text-2xl font-bold">
              {league ? "League unavailable" : "League not found"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {error || "This league does not exist in NOVA."}
            </p>
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Competition
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                {league.name}
              </h1>
              {league.slug && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {league.slug}
                </p>
              )}
            </div>
            {league.status && (
              <span className="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {league.status}
              </span>
            )}
          </div>
        </header>
        {divisions.length === 0 ? (
          <section className="rounded-xl border bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">No divisions yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Divisions for this league will appear here once they are
              created.
            </p>
          </section>
        ) : (
          <div className="space-y-8">
            {standingsByDivision.map(({ division, rows }) => (
              <section key={division.id}>
                <div className="mb-3">
                  <h2 className="text-xl font-semibold">
                    {division.name}
                  </h2>
                  {division.season && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {division.season}
                    </p>
                  )}
                </div>
                {rows.length === 0 ? (
                  <div className="rounded-xl border bg-card px-6 py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      No standings available for this division yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border bg-card">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="border-b bg-muted/40">
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Team</th>
                          <th className="px-4 py-3 text-center">P</th>
                          <th className="px-4 py-3 text-center">W</th>
                          <th className="px-4 py-3 text-center">D</th>
                          <th className="px-4 py-3 text-center">L</th>
                          <th className="px-4 py-3 text-center">GF</th>
                          <th className="px-4 py-3 text-center">GA</th>
                          <th className="px-4 py-3 text-center">GD</th>
                          <th className="px-4 py-3 text-center">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((standing, index) => (
                          <tr
                            key={standing.id}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-4 py-4 font-semibold">
                              {index + 1}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                {standing.team?.logo_url ? (
                                  <img
                                    src={standing.team.logo_url}
                                    alt=""
                                    className="size-8 object-contain"
                                  />
                                ) : (
                                  <div className="size-8 rounded-full border" />
                                )}
                                <span className="font-medium">
                                  {standing.team?.name ?? "Unknown team"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              {standing.played}
                            </td>
                            <td className="px-4 py-4 text-center">
                              {standing.wins}
                            </td>
                            <td className="px-4 py-4 text-center">
                              {standing.draws}
                            </td>
                            <td className="px-4 py-4 text-center">
                              {standing.losses}
                            </td>
                            <td className="px-4 py-4 text-center">
                              {standing.goals_for}
                            </td>
                            <td className="px-4 py-4 text-center">
                              {standing.goals_against}
                            </td>
                            <td className="px-4 py-4 text-center">
                              {standing.goal_difference}
                            </td>
                            <td className="px-4 py-4 text-center font-bold">
                              {standing.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
