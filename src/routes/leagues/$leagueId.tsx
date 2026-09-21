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

type Tab = "overview" | "table" | "fixtures" | "results";

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
  tier: number | null;
  status: string | null;
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
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  team: Team | null;
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
  home_team: Team | null;
  away_team: Team | null;
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
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [selectedGameweek, setSelectedGameweek] = useState<number | null>(
    null,
  );
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLeague() {
      setLoading(true);
      setError("");

      const leagueResponse = await supabase
        .from("leagues")
        .select("id,name,slug,status")
        .eq("id", leagueId)
        .maybeSingle();

      if (leagueResponse.error) {
        console.error(leagueResponse.error);
        setError("Couldn't load this league.");
        setLoading(false);
        return;
      }

      if (!leagueResponse.data) {
        setError("League not found.");
        setLoading(false);
        return;
      }

      setLeague(leagueResponse.data as League);

      const divisionResponse = await supabase
        .from("divisions")
        .select("id,name,league_id,season,tier,status")
        .eq("league_id", leagueId)
        .order("tier", { ascending: true })
        .order("name", { ascending: true });

      if (divisionResponse.error) {
        console.error(divisionResponse.error);
        setError("Couldn't load this league's divisions.");
        setLoading(false);
        return;
      }

      const loadedDivisions = (divisionResponse.data ?? []) as Division[];
      setDivisions(loadedDivisions);

      if (loadedDivisions.length === 0) {
        setStandings([]);
        setFixtures([]);
        setGameweeks([]);
        setLoading(false);
        return;
      }

      const divisionIds = loadedDivisions.map((division) => division.id);

      const [standingsResponse, fixturesResponse, gameweeksResponse] =
        await Promise.all([
          supabase
            .from("standings")
            .select(
              `
                id,
                division_id,
                team_id,
                played,
                won,
                drawn,
                lost,
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

      if (standingsResponse.error) {
        console.error(standingsResponse.error);
        setError("Couldn't load the standings.");
        setLoading(false);
        return;
      }

      if (fixturesResponse.error) {
        console.error(fixturesResponse.error);
        setError("Couldn't load the fixtures.");
        setLoading(false);
        return;
      }

      if (gameweeksResponse.error) {
        console.error(gameweeksResponse.error);
        setError("Couldn't load the gameweeks.");
        setLoading(false);
        return;
      }

      setStandings((standingsResponse.data ?? []) as Standing[]);
      setFixtures((fixturesResponse.data ?? []) as Fixture[]);
      setGameweeks((gameweeksResponse.data ?? []) as Gameweek[]);

      setSelectedDivisionId((current) =>
        current || loadedDivisions[0].id,
      );

      setLoading(false);
    }

    void loadLeague();
  }, [leagueId]);

  const selectedDivision =
    divisions.find((division) => division.id === selectedDivisionId) ??
    divisions[0] ??
    null;

  const divisionStandings = useMemo(() => {
    if (!selectedDivision) return [];

    return standings
      .filter(
        (standing) => standing.division_id === selectedDivision.id,
      )
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;

        if (b.goal_difference !== a.goal_difference) {
          return b.goal_difference - a.goal_difference;
        }

        return b.goals_for - a.goals_for;
      });
  }, [standings, selectedDivision]);

  const divisionFixtures = useMemo(() => {
    if (!selectedDivision) return [];

    return fixtures
      .filter(
        (fixture) => fixture.division_id === selectedDivision.id,
      )
      .sort(
        (a, b) =>
          new Date(a.kickoff_at).getTime() -
          new Date(b.kickoff_at).getTime(),
      );
  }, [fixtures, selectedDivision]);

  const divisionGameweeks = useMemo(() => {
    if (!selectedDivision) return [];

    return gameweeks.filter(
      (gameweek) => gameweek.division_id === selectedDivision.id,
    );
  }, [gameweeks, selectedDivision]);

  const completedFixtures = useMemo(
    () =>
      divisionFixtures.filter(
        (fixture) =>
          fixture.status === "completed" ||
          fixture.completed_at !== null ||
          (fixture.home_score !== null &&
            fixture.away_score !== null),
      ),
    [divisionFixtures],
  );

  const upcomingFixtures = useMemo(
    () =>
      divisionFixtures.filter(
        (fixture) =>
          fixture.status !== "completed" &&
          fixture.completed_at === null &&
          (fixture.home_score === null ||
            fixture.away_score === null),
      ),
    [divisionFixtures],
  );

  const filteredFixtures = useMemo(() => {
    if (selectedGameweek === null) return divisionFixtures;

    return divisionFixtures.filter(
      (fixture) => fixture.gameweek === selectedGameweek,
    );
  }, [divisionFixtures, selectedGameweek]);

  function changeDivision(divisionId: string) {
    setSelectedDivisionId(divisionId);
    setSelectedGameweek(null);
  }

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
              className="mt-5 inline-block text-sm font-semibold underline"
            >
              Back to leagues
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const tierLabel = (() => {
    const tiers = divisions
      .map((division) => division.tier)
      .filter((tier): tier is number => tier !== null);

    const unique = [...new Set(tiers)];

    if (unique.length === 0) return "No tier";

    if (unique.length === 1) return `Tier ${unique[0]}`;

    return `Tiers ${Math.min(...unique)}-${Math.max(...unique)}`;
  })();

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
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Competition
              </p>

              <h1 className="mt-2 text-4xl font-bold tracking-tight">
                {league.name}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                  {tierLabel}
                </span>

                {league.status && (
                  <span className="rounded-full border px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
                    {league.status}
                  </span>
                )}

                {league.slug && (
                  <span className="text-xs text-muted-foreground">
                    {league.slug}
                  </span>
                )}
              </div>
            </div>

            <FavouriteButton
              itemType="league"
              itemId={league.id}
            />
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
            <div className="mb-6 flex flex-wrap gap-2">
              {divisions.map((division) => {
                const active =
                  division.id === selectedDivision?.id;

                return (
                  <button
                    key={division.id}
                    type="button"
                    onClick={() => changeDivision(division.id)}
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
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
              <>
                <div className="mb-8 rounded-xl border bg-card p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Division
                      </p>

                      <h2 className="mt-1 text-2xl font-bold">
                        {selectedDivision.name}
                      </h2>

                      {selectedDivision.season && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedDivision.season}
                        </p>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {divisionStandings.length} teams
                    </div>
                  </div>
                </div>

                <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatCard
                    icon={<Trophy className="size-5" />}
                    label="Teams"
                    value={String(divisionStandings.length)}
                  />

                  <StatCard
                    icon={<CalendarDays className="size-5" />}
                    label="Fixtures"
                    value={String(divisionFixtures.length)}
                  />

                  <StatCard
                    icon={<Clock3 className="size-5" />}
                    label="Upcoming"
                    value={String(upcomingFixtures.length)}
                  />

                  <StatCard
                    icon={<Trophy className="size-5" />}
                    label="Results"
                    value={String(completedFixtures.length)}
                  />
                </div>

                <div className="mb-6 flex overflow-x-auto border-b">
                  <TabButton
                    active={tab === "overview"}
                    onClick={() => setTab("overview")}
                  >
                    Overview
                  </TabButton>

                  <TabButton
                    active={tab === "table"}
                    onClick={() => setTab("table")}
                  >
                    Table
                  </TabButton>

                  <TabButton
                    active={tab === "fixtures"}
                    onClick={() => setTab("fixtures")}
                  >
                    Fixtures
                  </TabButton>

                  <TabButton
                    active={tab === "results"}
                    onClick={() => setTab("results")}
                  >
                    Results
                  </TabButton>
                </div>

                {tab === "overview" && (
                  <Overview
                    upcomingFixtures={upcomingFixtures.slice(0, 5)}
                    completedFixtures={completedFixtures
                      .slice()
                      .reverse()
                      .slice(0, 5)}
                  />
                )}

                {tab === "table" && (
                  <StandingsTable standings={divisionStandings} />
                )}

                {tab === "fixtures" && (
                  <FixtureList
                    fixtures={filteredFixtures.filter(
                      (fixture) =>
                        fixture.status !== "completed" &&
                        fixture.completed_at === null &&
                        (fixture.home_score === null ||
                          fixture.away_score === null),
                    )}
                    gameweeks={divisionGameweeks}
                    selectedGameweek={selectedGameweek}
                    onGameweekChange={setSelectedGameweek}
                    emptyMessage="No upcoming fixtures."
                  />
                )}

                {tab === "results" && (
                  <FixtureList
                    fixtures={filteredFixtures.filter(
                      (fixture) =>
                        fixture.status === "completed" ||
                        fixture.completed_at !== null ||
                        (fixture.home_score !== null &&
                          fixture.away_score !== null),
                    )}
                    gameweeks={divisionGameweeks}
                    selectedGameweek={selectedGameweek}
                    onGameweekChange={setSelectedGameweek}
                    emptyMessage="No results yet."
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-semibold transition ${
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
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
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}

        <span className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Overview({
  upcomingFixtures,
  completedFixtures,
}: {
  upcomingFixtures: Fixture[];
  completedFixtures: Fixture[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-5">
          <h2 className="text-lg font-bold">Upcoming</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            The next fixtures in this division.
          </p>
        </div>

        {upcomingFixtures.length === 0 ? (
          <EmptyState text="No upcoming fixtures." />
        ) : (
          <div className="space-y-3">
            {upcomingFixtures.map((fixture) => (
              <FixtureRow
                key={fixture.id}
                fixture={fixture}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="mb-5">
          <h2 className="text-lg font-bold">Latest results</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            The most recently completed matches.
          </p>
        </div>

        {completedFixtures.length === 0 ? (
          <EmptyState text="No results yet." />
        ) : (
          <div className="space-y-3">
            {completedFixtures.map((fixture) => (
              <FixtureRow
                key={fixture.id}
                fixture={fixture}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StandingsTable({
  standings,
}: {
  standings: Standing[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="text-lg font-bold">League Table</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Live standings from NOVA.
        </p>
      </div>

      {standings.length === 0 ? (
        <EmptyState text="No standings available yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-semibold">#</th>
                <th className="px-3 py-3 font-semibold">Team</th>
                <th className="px-3 py-3 text-center font-semibold">
                  P
                </th>
                <th className="px-3 py-3 text-center font-semibold">
                  W
                </th>
                <th className="px-3 py-3 text-center font-semibold">
                  D
                </th>
                <th className="px-3 py-3 text-center font-semibold">
                  L
                </th>
                <th className="px-3 py-3 text-center font-semibold">
                  GD
                </th>
                <th className="px-5 py-3 text-center font-semibold">
                  PTS
                </th>
              </tr>
            </thead>

            <tbody>
              {standings.map((standing, index) => (
                <tr
                  key={standing.id}
                  className="border-b last:border-b-0"
                >
                  <td className="px-5 py-4 font-semibold text-muted-foreground">
                    {index + 1}
                  </td>

                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      {standing.team?.logo_url ? (
                        <img
                          src={standing.team.logo_url}
                          alt=""
                          className="size-7 rounded-full object-contain"
                        />
                      ) : (
                        <div className="flex size-7 items-center justify-center rounded-full border text-[10px] font-bold">
                          {standing.team?.name?.slice(0, 1) ?? "?"}
                        </div>
                      )}

                      <span className="font-semibold">
                        {standing.team?.name ?? "Unknown team"}
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-4 text-center">
                    {standing.played}
                  </td>

                  <td className="px-3 py-4 text-center">
                    {standing.won}
                  </td>

                  <td className="px-3 py-4 text-center">
                    {standing.drawn}
                  </td>

                  <td className="px-3 py-4 text-center">
                    {standing.lost}
                  </td>

                  <td className="px-3 py-4 text-center">
                    {standing.goal_difference > 0
                      ? `+${standing.goal_difference}`
                      : standing.goal_difference}
                  </td>

                  <td className="px-5 py-4 text-center font-bold">
                    {standing.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FixtureList({
  fixtures,
  gameweeks,
  selectedGameweek,
  onGameweekChange,
  emptyMessage,
}: {
  fixtures: Fixture[];
  gameweeks: Gameweek[];
  selectedGameweek: number | null;
  onGameweekChange: (value: number | null) => void;
  emptyMessage: string;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Matches</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            All matches generated for this division.
          </p>
        </div>

        {gameweeks.length > 0 && (
          <div className="relative">
            <select
              value={
                selectedGameweek === null
                  ? "all"
                  : String(selectedGameweek)
              }
              onChange={(event) => {
                const value = event.target.value;

                onGameweekChange(
                  value === "all" ? null : Number(value),
                );
              }}
              className="appearance-none rounded-lg border bg-background py-2 pl-3 pr-9 text-sm font-semibold outline-none"
            >
              <option value="all">All Gameweeks</option>

              {gameweeks.map((gameweek) => (
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

      {fixtures.length === 0 ? (
        <EmptyState text={emptyMessage} />
      ) : (
        <div className="divide-y">
          {fixtures.map((fixture) => (
            <FixtureRow
              key={fixture.id}
              fixture={fixture}
              detailed
            />
          ))}
        </div>
      )}
    </section>
  );
}
function FixtureRow({
  fixture,
  detailed = false,
}: {
  fixture: Fixture;
  detailed?: boolean;
}) {
  const completed =
    fixture.status === "completed" ||
    fixture.completed_at !== null ||
    (fixture.home_score !== null &&
      fixture.away_score !== null);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {fixture.gameweek !== null && (
            <span>GW {fixture.gameweek}</span>
          )}

          <span>•</span>

          <span>
            {new Date(fixture.kickoff_at).toLocaleDateString()}
          </span>

          {detailed && fixture.competition && (
            <>
              <span>•</span>
              <span>{fixture.competition}</span>
            </>
          )}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {fixture.home_team?.logo_url && (
              <img
                src={fixture.home_team.logo_url}
                alt=""
                className="size-6 rounded-full object-contain"
              />
            )}

            <span className="truncate text-sm font-semibold">
              {fixture.home_team?.name ?? "TBD"}
            </span>
          </div>

          <div className="text-center text-sm font-bold">
            {completed
              ? `${fixture.home_score ?? 0} - ${fixture.away_score ?? 0}`
              : "vs"}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate text-right text-sm font-semibold">
              {fixture.away_team?.name ?? "TBD"}
            </span>

            {fixture.away_team?.logo_url && (
              <img
                src={fixture.away_team.logo_url}
                alt=""
                className="size-6 rounded-full object-contain"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}