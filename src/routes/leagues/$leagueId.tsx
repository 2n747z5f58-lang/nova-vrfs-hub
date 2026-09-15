import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Clock3,
  Trophy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FavouriteButton } from "@/components/nova/FavouriteButton";
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
  tier?: number | null;
  status?: string | null;
};
type Team = {
  id: string;
  name: string;
  logo_url: string | null;
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
  team?: Team | null;
};
type Gameweek = {
  id: string;
  division_id: string;
  number: number;
  starts_at: string;
};
type Fixture = {
  id: string;
  league_id: string | null;
  division_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  gameweek: number | null;
  competition: string | null;
  completed_at: string | null;
  deadline_at: string | null;
  home_team?: Team | null;
  away_team?: Team | null;
};
type DivisionSection = {
  division: Division;
  standings: Standing[];
  fixtures: Fixture[];
  gameweeks: Gameweek[];
};
export const Route = createFileRoute("/leagues/$leagueId")({
  component: LeagueDetail,
});
function LeagueDetail() {
  const { leagueId } = Route.useParams();
  const [league, setLeague] = useState<League | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [selectedGameweek, setSelectedGameweek] = useState<number | null>(
    null,
  );
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
      setLeague(leagueData as League);
      const { data: divisionData, error: divisionError } = await supabase
        .from("divisions")
        .select("id,name,league_id,season,tier,status")
        .eq("league_id", leagueId)
        .order("tier", { ascending: true })
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
        setFixtures([]);
        setGameweeks([]);
        setLoading(false);
        return;
      }
      const divisionIds = loadedDivisions.map((division) => division.id);
      const [standingResponse, fixtureResponse, gameweekResponse] =
        await Promise.all([
          supabase
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
            .order("goals_for", { ascending: false }),
          supabase
            .from("fixtures")
            .select(
              `
                id,
                league_id,
                division_id,
                home_team_id,
                away_team_id,
                kickoff_at,
                status,
                home_score,
                away_score,
                gameweek,
                competition,
                completed_at,
                deadline_at,
                home_team:teams!fixtures_home_team_id_fkey (
                  id,
                  name,
                  logo_url
                ),
                away_team:teams!fixtures_away_team_id_fkey (
                  id,
                  name,
                  logo_url
                )
              `,
            )
            .eq("league_id", leagueId)
            .order("kickoff_at", { ascending: true }),
          supabase
            .from("gameweeks")
            .select("id,division_id,number,starts_at")
            .in("division_id", divisionIds)
            .order("number", { ascending: true }),
        ]);
      if (standingResponse.error) {
        console.error(
          "Failed to load standings:",
          standingResponse.error,
        );
        setError("Couldn't load the league standings.");
        setLoading(false);
        return;
      }
      if (fixtureResponse.error) {
        console.error(
          "Failed to load fixtures:",
          fixtureResponse.error,
        );
        setError("Couldn't load the league fixtures.");
        setLoading(false);
        return;
      }
      if (gameweekResponse.error) {
        console.error(
          "Failed to load gameweeks:",
          gameweekResponse.error,
        );
        setError("Couldn't load the league gameweeks.");
        setLoading(false);
        return;
      }
      const loadedStandings = (standingResponse.data ??
        []) as Standing[];
      const loadedFixtures = (fixtureResponse.data ??
        []) as Fixture[];
      const loadedGameweeks = (gameweekResponse.data ??
        []) as Gameweek[];
      setStandings(loadedStandings);
      setFixtures(loadedFixtures);
      setGameweeks(loadedGameweeks);
      if (!selectedDivisionId && loadedDivisions.length > 0) {
        setSelectedDivisionId(loadedDivisions[0].id);
      }
      setLoading(false);
    }
    void loadLeague();
  }, [leagueId, selectedDivisionId]);
  const selectedDivision =
    divisions.find((division) => division.id === selectedDivisionId) ??
    divisions[0] ??
    null;
  const selectedDivisionFixtures = useMemo(() => {
    if (!selectedDivision) return [];
    return fixtures.filter(
      (fixture) => fixture.division_id === selectedDivision.id,
    );
  }, [fixtures, selectedDivision]);
  const selectedDivisionStandings = useMemo(() => {
    if (!selectedDivision) return [];
    return standings.filter(
      (standing) => standing.division_id === selectedDivision.id,
    );
  }, [standings, selectedDivision]);
  const selectedDivisionGameweeks = useMemo(() => {
    if (!selectedDivision) return [];
    return gameweeks.filter(
      (gameweek) => gameweek.division_id === selectedDivision.id,
    );
  }, [gameweeks, selectedDivision]);
  const filteredFixtures = useMemo(() => {
    if (selectedGameweek === null) {
      return selectedDivisionFixtures;
    }
    return selectedDivisionFixtures.filter(
      (fixture) => fixture.gameweek === selectedGameweek,
    );
  }, [selectedDivisionFixtures, selectedGameweek]);
  const completedFixtures = useMemo(
    () =>
      selectedDivisionFixtures.filter(
        (fixture) =>
          fixture.status === "completed" ||
          fixture.completed_at !== null ||
          (fixture.home_score !== null &&
            fixture.away_score !== null),
      ),
    [selectedDivisionFixtures],
  );
  const upcomingFixtures = useMemo(
    () =>
      selectedDivisionFixtures.filter(
        (fixture) =>
          fixture.status !== "completed" &&
          fixture.completed_at === null,
      ),
    [selectedDivisionFixtures],
  );
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
            <Link
              to="/leagues"
              className="mt-5 inline-block text-sm font-medium underline"
            >
              Back to leagues
            </Link>
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/leagues"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to leagues
        </Link>
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Competition
          </p>
          <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
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
            <div className="flex flex-wrap items-center gap-3">
              {league.status && (
                <span className="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {league.status}
                </span>
              )}
              <FavouriteButton
                itemType="league"
                itemId={league.id}
              />
            </div>
          </div>
        </header>
        {divisions.length === 0 ? (
          <section className="rounded-xl border bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">
              No divisions yet
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Divisions for this league will appear here once they are
              created.
            </p>
          </section>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap gap-2">
              {divisions.map((division) => {
                const active = division.id === selectedDivision?.id;
                return (
                  <button
                    key={division.id}
                    type="button"
                    onClick={() => {
                      setSelectedDivisionId(division.id);
                      setSelectedGameweek(null);
                    }}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-foreground text-background"
                        : "bg-card hover:bg-muted"
                    }`}
                  >
                    {division.name}
                  </button>
                );
              })}
            </div>
            {selectedDivision && (
              <div className="space-y-10">
                <section>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Trophy className="size-5" />
                        <h2 className="text-2xl font-bold">
                          {selectedDivision.name}
                        </h2>
                      </div>
                      {selectedDivision.season && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedDivision.season}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-5 text-sm text-muted-foreground">
                      <span>
                        {upcomingFixtures.length} upcoming
                      </span>
                      <span>
                        {completedFixtures.length} results
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                      icon={<CalendarDays className="size-5" />}
                      label="Fixtures"
                      value={String(selectedDivisionFixtures.length)}
                    />
                    <StatCard
                      icon={<Trophy className="size-5" />}
                      label="Results"
                      value={String(completedFixtures.length)}
                    />
                    <StatCard
                      icon={<Clock3 className="size-5" />}
                      label="Gameweeks"
                      value={String(selectedDivisionGameweeks.length)}
                    />
                  </div>
                </section>
                <section>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold">
                        Fixtures & Results
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Every fixture generated for this division is
                        available here.
                      </p>
                    </div>
                    {selectedDivisionGameweeks.length > 0 && (
                      <div className="relative">
                        <select
                          value={
                            selectedGameweek === null
                              ? "all"
                              : String(selectedGameweek)
                          }
                          onChange={(event) => {
                            const value = event.target.value;
                            setSelectedGameweek(
                              value === "all"
                                ? null
                                : Number(value),
                            );
                          }}
                          className="appearance-none rounded-lg border bg-card py-2 pl-3 pr-9 text-sm font-medium outline-none"
                        >
                          <option value="all">
                            All Gameweeks
                          </option>
                          {selectedDivisionGameweeks.map((gameweek) => (
                            <option
                              key={gameweek.id}
                              value={gameweek.number}
                            >
                              Gameweek {gameweek.number}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
                      </div>
                    )}
                  </div>
                  {filteredFixtures.length === 0 ? (
                    <div className="rounded-xl border bg-card px-6 py-12 text-center">
                      <CalendarDays className="mx-auto size-8 text-muted-foreground" />
                      <h3 className="mt-3 font-semibold">
                        No fixtures yet
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Fixtures will appear here once the division is
                        started.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border bg-card">
                      <div className="divide-y">
                        {filteredFixtures.map((fixture) => (
                          <FixtureRow
                            key={fixture.id}
                            fixture={fixture}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
                <section>
                  <div className="mb-4">
                    <h2 className="text-xl font-bold">Table</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Current standings for {selectedDivision.name}.
                    </p>
                  </div>
                  {selectedDivisionStandings.length === 0 ? (
                    <div className="rounded-xl border bg-card px-6 py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        No standings available yet.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border bg-card">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="border-b bg-muted/40">
                          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3">Team</th>
                            <th className="px-4 py-3 text-center">
                              P
                            </th>
                            <th className="px-4 py-3 text-center">
                              W
                            </th>
                            <th className="px-4 py-3 text-center">
                              D
                            </th>
                            <th className="px-4 py-3 text-center">
                              L
                            </th>
                            <th className="px-4 py-3 text-center">
                              GF
                            </th>
                            <th className="px-4 py-3 text-center">
                              GA
                            </th>
                            <th className="px-4 py-3 text-center">
                              GD
                            </th>
                            <th className="px-4 py-3 text-center">
                              Pts
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDivisionStandings.map(
                            (standing, index) => (
                              <tr
                                key={standing.id}
                                className="border-b last:border-b-0"
                              >
                                <td className="px-4 py-4 font-semibold">
                                  {index + 1}
                                </td>
                                <td className="px-4 py-4">
                                  <Link
                                    to="/teams/$teamId"
                                    params={{
                                      teamId: standing.team_id,
                                    }}
                                    className="flex items-center gap-3 transition hover:opacity-70"
                                  >
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
                                      {standing.team?.name ??
                                        "Unknown team"}
                                    </span>
                                  </Link>
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
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}
function FixtureRow({ fixture }: { fixture: Fixture }) {
  const completed =
    fixture.status === "completed" ||
    fixture.completed_at !== null ||
    (fixture.home_score !== null &&
      fixture.away_score !== null);
  const kickoff = new Date(fixture.kickoff_at);
  return (
    <div className="grid gap-4 px-5 py-5 sm:grid-cols-[120px_1fr_100px] sm:items-center">
      <div className="text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {fixture.gameweek
            ? `Gameweek ${fixture.gameweek}`
            : "Fixture"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {kickoff.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
          })}
        </p>
      </div>
      <div className="space-y-3">
        <TeamLine
          team={fixture.home_team}
          score={fixture.home_score}
        />
        <TeamLine
          team={fixture.away_team}
          score={fixture.away_score}
        />
      </div>
      <div className="text-center sm:text-right">
        {completed ? (
          <span className="rounded-full border px-3 py-1.5 text-xs font-semibold">
            FT
          </span>
        ) : (
          <div>
            <p className="text-sm font-semibold">
              {kickoff.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Upcoming
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
function TeamLine({
  team,
  score,
}: {
  team?: Team | null;
  score: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {team?.logo_url ? (
          <img
            src={team.logo_url}
            alt=""
            className="size-8 shrink-0 object-contain"
          />
        ) : (
          <div className="size-8 shrink-0 rounded-full border" />
        )}
        <span className="truncate text-sm font-medium">
          {team?.name ?? "Unknown team"}
        </span>
      </div>
      <span className="min-w-5 text-right text-sm font-bold">
        {score !== null ? score : ""}
      </span>
    </div>
  );
}
