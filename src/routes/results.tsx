import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
type Result = {
  id: string;
  fixture_id: string;
  home_score: number;
  away_score: number;
  completed_at: string | null;
  fixture?: {
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
  } | null;
};
export const Route = createFileRoute("/results")({
  component: Results,
});
function Results() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadResults();
  }, []);
  async function loadResults() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("results")
      .select(`
        id,
        fixture_id,
        home_score,
        away_score,
        completed_at,
        fixture:fixtures!results_fixture_id_fkey (
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
        )
      `)
      .order("completed_at", { ascending: false });
    if (error) {
      console.error("Failed to load results:", error);
      setError("Couldn't load results.");
      setLoading(false);
      return;
    }
    setResults((data ?? []) as Result[]);
    setLoading(false);
  }
  function formatDate(date: string | null) {
    if (!date) return "Date unknown";
    return new Date(date).toLocaleString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading results...
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
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Final scores
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Results
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Completed matches and their final scorelines.
          </p>
        </div>
        {results.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">
              No results available
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Completed matches will appear here when results are recorded.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            {results.map((result, index) => {
              const fixture = result.fixture;
              return (
                <div
                  key={result.id}
                  className={`px-4 py-6 md:px-6 ${
                    index !== results.length - 1 ? "border-b" : ""
                  }`}
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {fixture?.gameweek !== null &&
                        fixture?.gameweek !== undefined && (
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            GW {fixture.gameweek}
                          </span>
                        )}
                      <span className="text-xs text-muted-foreground">
                        {fixture?.competition ?? "League"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(
                        result.completed_at ?? fixture?.kickoff_at ?? null,
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <Team
                      name={fixture?.home_team?.name ?? "Home team"}
                      logo={fixture?.home_team?.logo_url ?? null}
                    />
                    <div className="text-center">
                      <div className="text-2xl font-bold tracking-tight">
                        {result.home_score} - {result.away_score}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Full time
                      </div>
                    </div>
                    <Team
                      name={fixture?.away_team?.name ?? "Away team"}
                      logo={fixture?.away_team?.logo_url ?? null}
                      align="right"
                    />
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
function Team({
  name,
  logo,
  align = "left",
}: {
  name: string;
  logo: string | null;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      {align === "right" ? null : logo ? (
        <img
          src={logo}
          alt=""
          className="h-9 w-9 shrink-0 object-contain"
        />
      ) : (
        <div className="h-9 w-9 shrink-0 rounded-full border" />
      )}
      <span
        className={`truncate text-sm font-semibold ${
          align === "right" ? "text-right" : ""
        }`}
      >
        {name}
      </span>
      {align === "right" &&
        (logo ? (
          <img
            src={logo}
            alt=""
            className="h-9 w-9 shrink-0 object-contain"
          />
        ) : (
          <div className="h-9 w-9 shrink-0 rounded-full border" />
        ))}
    </div>
  );
}
