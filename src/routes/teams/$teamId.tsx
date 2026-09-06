import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FavouriteButton } from "@/components/nova/FavouriteButton";

type Team = {
  id: string;
  name: string;
  logo_url: string | null;
};

type Player = {
  id: string;
  name: string;
  position: string | null;
  avatar_url: string | null;
};

type Fixture = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  kickoff_at: string | null;
  gameweek: number | null;
  competition: string | null;
  home_team?: {
    name: string;
  } | null;
  away_team?: {
    name: string;
  } | null;
};

export const Route = createFileRoute("/teams/$teamId")({
  ssr: false,
  component: TeamDetail,
});

function TeamDetail() {
  const { teamId } = Route.useParams();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTeam() {
      setLoading(true);
      setError("");

      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("id, name, logo_url")
        .eq("id", teamId)
        .maybeSingle();

      if (teamError) {
        console.error("Failed to load team:", teamError);
        setError("Couldn't load this team.");
        setLoading(false);
        return;
      }

      if (!teamData) {
        setError("Team not found.");
        setLoading(false);
        return;
      }

      setTeam(teamData as Team);

      const [playersResult, fixturesResult] = await Promise.all([
        supabase
          .from("players")
          .select("id, name, position, avatar_url")
          .eq("team_id", teamId)
          .order("name", { ascending: true }),

        supabase
          .from("fixtures")
          .select(`
            id,
            home_team_id,
            away_team_id,
            home_score,
            away_score,
            status,
            kickoff_at,
            gameweek,
            competition,
            home_team:teams!fixtures_home_team_id_fkey (
              name
            ),
            away_team:teams!fixtures_away_team_id_fkey (
              name
            )
          `)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .order("kickoff_at", { ascending: false }),
      ]);

      if (playersResult.error) {
        console.error(
          "Failed to load team players:",
          playersResult.error,
        );
      } else {
        setPlayers((playersResult.data ?? []) as Player[]);
      }

      if (fixturesResult.error) {
        console.error(
          "Failed to load team fixtures:",
          fixturesResult.error,
        );
      } else {
        setFixtures((fixturesResult.data ?? []) as Fixture[]);
      }

      setLoading(false);
    }

    void loadTeam();
  }, [teamId]);

  function formatDate(date: string | null) {
    if (!date) return "TBC";

    return new Date(date).toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Loading team...
          </p>
        </div>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center text-center">
          <div>
            <h1 className="text-2xl font-bold">
              Team not found
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {error || "This team does not exist in NOVA."}
            </p>

            <Link
              to="/teams"
              className="mt-5 inline-block text-sm font-medium underline"
            >
              Back to teams
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const completedFixtures = fixtures.filter(
    (fixture) => fixture.status === "completed",
  );

  const upcomingFixtures = fixtures
    .filter((fixture) => fixture.status !== "completed")
    .reverse();

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/teams"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to teams
        </Link>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted">
                  {team.logo_url ? (
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="size-full object-contain p-3"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-muted-foreground">
                      {team.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Team profile
                  </p>

                  <h1 className="mt-2 text-4xl font-bold tracking-tight">
                    {team.name}
                  </h1>

                  <p className="mt-3 text-sm text-muted-foreground">
                    {players.length} player
                    {players.length === 1 ? "" : "s"} registered
                    {" • "}
                    {fixtures.length} fixture
                    {fixtures.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <FavouriteButton
                itemType="team"
                itemId={team.id}
              />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Users className="size-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Squad
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold">
              {players.length}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Calendar className="size-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Fixtures
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold">
              {fixtures.length}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Trophy className="size-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Results
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold">
              {completedFixtures.length}
            </p>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Squad
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Players
            </h2>
          </div>

          {players.length === 0 ? (
            <div className="rounded-xl border bg-card px-6 py-12 text-center">
              <h3 className="font-semibold">
                No players registered
              </h3>

              <p className="mt-2 text-sm text-muted-foreground">
                Players assigned to this team will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => (
                <Link
                  key={player.id}
                  to="/players/$playerId"
                  params={{ playerId: player.id }}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:bg-accent/40"
                >
                  <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted">
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt={player.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-muted-foreground">
                        {player.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {player.name}
                    </p>

                    <p className="truncate text-xs text-muted-foreground">
                      {player.position ?? "Position not set"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Schedule
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Upcoming fixtures
            </h2>
          </div>

          {upcomingFixtures.length === 0 ? (
            <div className="rounded-xl border bg-card px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No upcoming fixtures.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              {upcomingFixtures.map((fixture, index) => (
                <div
                  key={fixture.id}
                  className={`p-5 ${
                    index !== upcomingFixtures.length - 1
                      ? "border-b"
                      : ""
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        {fixture.home_team?.name ?? "Home team"} vs{" "}
                        {fixture.away_team?.name ?? "Away team"}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {fixture.competition ?? "League"}
                        {" • "}
                        {formatDate(fixture.kickoff_at)}
                      </p>
                    </div>

                    {fixture.gameweek !== null && (
                      <span className="text-xs text-muted-foreground">
                        GW {fixture.gameweek}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              History
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Results
            </h2>
          </div>

          {completedFixtures.length === 0 ? (
            <div className="rounded-xl border bg-card px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No completed matches yet.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              {completedFixtures.map((fixture, index) => (
                <div
                  key={fixture.id}
                  className={`p-5 ${
                    index !== completedFixtures.length - 1
                      ? "border-b"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {fixture.home_team?.name ?? "Home team"} vs{" "}
                        {fixture.away_team?.name ?? "Away team"}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(fixture.kickoff_at)}
                      </p>
                    </div>

                    <p className="shrink-0 text-xl font-bold">
                      {fixture.home_score ?? 0} -{" "}
                      {fixture.away_score ?? 0}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
