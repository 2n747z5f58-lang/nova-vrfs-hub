import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
  away_team?: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
};
export const Route = createFileRoute("/fixtures")({
  component: Fixtures,
});
function Fixtures() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadFixtures();
  }, []);
  async function loadFixtures() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
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
          id,
          name,
          logo_url
        ),
        away_team:teams!fixtures_away_team_id_fkey (
          id,
          name,
          logo_url
        )
      `)
      .order("kickoff_at", { ascending: true });
    if (error) {
      console.error("Failed to load fixtures:", error);
      setError("Couldn't load fixtures.");
      setLoading(false);
      return;
    }
    setFixtures((data ?? []) as Fixture[]);
    setLoading(false);
  }
  const groupedFixtures = fixtures.reduce<Record<string, Fixture[]>>(
    (groups, fixture) => {
      const key =
        fixture.gameweek !== null
          ? `Gameweek ${fixture.gameweek}`
          : "Other fixtures";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(fixture);
      return groups;
    },
    {},
  );
  function formatKickoff(kickoff: string | null) {
    if (!kickoff) return "TBC";
    return new Date(kickoff).toLocaleString([], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function statusLabel(status: string | null) {
    switch (status) {
      case "completed":
        return "FT";
      case "scheduled":
        return "Scheduled";
      case "postponed":
        return "Postponed";
      case "cancelled":
        return "Cancelled";
      case "forfeit":
        return "Forfeit";
      default:
        return status ?? "Scheduled";
    }
  }
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading fixtures...
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
  if (fixtures.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-2xl font-semibold">No fixtures available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fixtures will appear here once they are added to NOVA.
        </p>
      </div>
    );
  }
  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Match centre
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Fixtures
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upcoming, live and completed fixtures.
          </p>
        </div>
        <div className="space-y-8">
          {Object.entries(groupedFixtures).map(
            ([gameweek, gameweekFixtures]) => (
              <section key={gameweek}>
                <h2 className="mb-3 text-lg font-semibold">
                  {gameweek}
                </h2>
                <div className="overflow-hidden rounded-xl border bg-card">
                  {gameweekFixtures.map((fixture, index) => {
                    const completed =
                      fixture.status === "completed";
                    return (
                      <div
                        key={fixture.id}
                        className={`px-4 py-5 md:px-6 ${
                          index !== gameweekFixtures.length - 1
                            ? "border-b"
                            : ""
                        }`}
                      >
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <span className="text-xs text-muted-foreground">
                            {fixture.competition ?? "League"}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">
                            {completed
                              ? statusLabel(fixture.status)
                              : formatKickoff(fixture.kickoff_at)}
                          </span>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            {fixture.home_team?.logo_url ? (
                              <img
                                src={fixture.home_team.logo_url}
                                alt=""
                                className="h-8 w-8 shrink-0 object-contain"
                              />
                            ) : (
                              <div className="h-8 w-8 shrink-0 rounded-full border" />
                            )}
                            <span className="truncate text-sm font-medium">
                              {fixture.home_team?.name ?? "Home team"}
                            </span>
                          </div>
                          <div className="text-center">
                            {fixture.home_score !== null &&
                            fixture.away_score !== null ? (
                              <span className="text-xl font-bold">
                                {fixture.home_score} -{" "}
                                {fixture.away_score}
                              </span>
                            ) : (
                              <span className="text-sm font-medium text-muted-foreground">
                                vs
                              </span>
                            )}
                          </div>
                          <div className="flex min-w-0 items-center justify-end gap-3">
                            <span className="truncate text-right text-sm font-medium">
                              {fixture.away_team?.name ?? "Away team"}
                            </span>
                            {fixture.away_team?.logo_url ? (
                              <img
                                src={fixture.away_team.logo_url}
                                alt=""
                                className="h-8 w-8 shrink-0 object-contain"
                              />
                            ) : (
                              <div className="h-8 w-8 shrink-0 rounded-full border" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
