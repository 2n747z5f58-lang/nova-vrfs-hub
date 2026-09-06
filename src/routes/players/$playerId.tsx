import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Award, Calendar, Shield, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FavouriteButton } from "@/components/nova/FavouriteButton";

type Player = {
  id: string;
  name: string;
  position: string | null;
  avatar_url: string | null;
  team_id: string | null;
  team?: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
};

type MatchEvent = {
  id: string;
  fixture_id: string;
  player_id: string | null;
  event_type: string;
  fixture?: {
    id: string;
    home_score: number | null;
    away_score: number | null;
    status: string | null;
    kickoff_at: string | null;
    home_team?: {
      name: string;
    } | null;
    away_team?: {
      name: string;
    } | null;
  } | null;
};

export const Route = createFileRoute("/players/$playerId")({
  ssr: false,
  component: PlayerDetail,
});

function PlayerDetail() {
  const { playerId } = Route.useParams();

  const [player, setPlayer] = useState<Player | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPlayer() {
      setLoading(true);
      setError("");

      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select(`
          id,
          name,
          position,
          avatar_url,
          team_id,
          team:teams (
            id,
            name,
            logo_url
          )
        `)
        .eq("id", playerId)
        .maybeSingle();

      if (playerError) {
        console.error("Failed to load player:", playerError);
        setError("Couldn't load this player.");
        setLoading(false);
        return;
      }

      if (!playerData) {
        setError("Player not found.");
        setLoading(false);
        return;
      }

      setPlayer(playerData as Player);

      const { data: eventData, error: eventError } = await supabase
        .from("match_events")
        .select(`
          id,
          fixture_id,
          player_id,
          event_type,
          fixture:fixtures (
            id,
            home_score,
            away_score,
            status,
            kickoff_at,
            home_team:teams!fixtures_home_team_id_fkey (
              name
            ),
            away_team:teams!fixtures_away_team_id_fkey (
              name
            )
          )
        `)
        .eq("player_id", playerId)
        .order("created_at", { ascending: false });

      if (eventError) {
        console.error("Failed to load player events:", eventError);
        setError(
          "Player loaded, but their match history couldn't be loaded.",
        );
        setLoading(false);
        return;
      }

      setEvents((eventData ?? []) as MatchEvent[]);
      setLoading(false);
    }

    void loadPlayer();
  }, [playerId]);

  const goals = events.filter(
    (event) => event.event_type === "goal",
  ).length;

  const assists = events.filter(
    (event) => event.event_type === "assist",
  ).length;

  const motm = events.filter(
    (event) =>
      event.event_type === "motm" ||
      event.event_type === "man_of_the_match",
  ).length;

  const fixtures = Array.from(
    new Map(
      events
        .filter((event) => event.fixture)
        .map((event) => [event.fixture_id, event.fixture]),
    ).values(),
  );

  function formatDate(date: string | null) {
    if (!date) return "Unknown date";

    return new Date(date).toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Loading player...
          </p>
        </div>
      </main>
    );
  }

  if (!player) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center text-center">
          <div>
            <h1 className="text-2xl font-bold">Player not found</h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {error || "This player does not exist in NOVA."}
            </p>

            <Link
              to="/players"
              className="mt-5 inline-block text-sm font-medium underline"
            >
              Back to players
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/players"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to players
        </Link>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted">
                  {player.avatar_url ? (
                    <img
                      src={player.avatar_url}
                      alt={player.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-muted-foreground">
                      {player.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Player profile
                  </p>

                  <h1 className="mt-2 text-4xl font-bold tracking-tight">
                    {player.name}
                  </h1>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {player.position && (
                      <span>{player.position}</span>
                    )}

                    {player.team && (
                      <span className="flex items-center gap-2">
                        {player.team.logo_url && (
                          <img
                            src={player.team.logo_url}
                            alt=""
                            className="size-5 object-contain"
                          />
                        )}

                        {player.team.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <FavouriteButton
                itemType="player"
                itemId={player.id}
              />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Calendar className="size-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Appearances
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
                Goals
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold">{goals}</p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Shield className="size-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Assists
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold">{assists}</p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Award className="size-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                MOTM
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold">{motm}</p>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Match history
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Recent appearances
            </h2>
          </div>

          {fixtures.length === 0 ? (
            <div className="rounded-xl border bg-card px-6 py-12 text-center">
              <h3 className="font-semibold">No match history yet</h3>

              <p className="mt-2 text-sm text-muted-foreground">
                Match appearances and events will appear here once this player
                has played.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              {fixtures.map((fixture, index) => (
                <div
                  key={fixture.id}
                  className={`p-5 ${
                    index !== fixtures.length - 1 ? "border-b" : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 font-semibold">
                        <span>
                          {fixture.home_team?.name ?? "Home team"}
                        </span>

                        <span className="text-muted-foreground">vs</span>

                        <span>
                          {fixture.away_team?.name ?? "Away team"}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(fixture.kickoff_at)}
                      </p>
                    </div>

                    <div className="text-right">
                      {fixture.home_score !== null &&
                      fixture.away_score !== null ? (
                        <p className="text-xl font-bold">
                          {fixture.home_score} - {fixture.away_score}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {fixture.status ?? "Scheduled"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && (
          <p className="mt-6 text-sm text-muted-foreground">{error}</p>
        )}
      </div>
    </main>
  );
}
