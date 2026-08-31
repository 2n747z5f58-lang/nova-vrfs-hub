import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Trophy, Users, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
type DashboardStats = {
  leagues: number;
  teams: number;
  players: number;
  fixtures: number;
};
export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: Dashboard,
});
function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    leagues: 0,
    teams: 0,
    players: 0,
    fixtures: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadDashboard();
  }, []);
  async function loadDashboard() {
    setLoading(true);
    setError(null);
    const [leagues, teams, players, fixtures] =
      await Promise.all([
        supabase
          .from("leagues")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("teams")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("players")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("fixtures")
          .select("id", { count: "exact", head: true }),
      ]);
    const firstError =
      leagues.error ??
      teams.error ??
      players.error ??
      fixtures.error;
    if (firstError) {
      console.error("Failed to load dashboard:", firstError);
      setError("Couldn't load NOVA data.");
      setLoading(false);
      return;
    }
    setStats({
      leagues: leagues.count ?? 0,
      teams: teams.count ?? 0,
      players: players.count ?? 0,
      fixtures: fixtures.count ?? 0,
    });
    setLoading(false);
  }
  const cards = [
    {
      label: "Leagues",
      value: stats.leagues,
      icon: Trophy,
    },
    {
      label: "Teams",
      value: stats.teams,
      icon: Shield,
    },
    {
      label: "Players",
      value: stats.players,
      icon: Users,
    },
    {
      label: "Fixtures",
      value: stats.fixtures,
      icon: CalendarDays,
    },
  ];
  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            VRFS / Control centre
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your NOVA overview, connected directly to the league database.
          </p>
        </div>
        {loading ? (
          <div className="flex min-h-[250px] items-center justify-center rounded-xl border bg-card">
            <p className="text-sm text-muted-foreground">
              Loading NOVA data...
            </p>
          </div>
        ) : error ? (
          <div className="flex min-h-[250px] items-center justify-center rounded-xl border bg-card">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="rounded-xl border bg-card p-5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {card.label}
                      </span>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="mt-4 text-3xl font-bold tracking-tight">
                      {card.value.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 rounded-xl border bg-card p-6">
              <h2 className="text-lg font-semibold">
                NOVA is connected
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Live league, team, player and fixture counts are being read
                from your Supabase database.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
