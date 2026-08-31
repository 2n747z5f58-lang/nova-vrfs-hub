import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
type Favourite = {
  id: string;
  user_id: string;
  league_id: string | null;
  team_id: string | null;
  player_id: string | null;
};
type Item = {
  id: string;
  name: string;
  type: "League" | "Team" | "Player";
};
export const Route = createFileRoute("/favourites")({
  ssr: false,
  component: Favourites,
});
function Favourites() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void loadFavourites();
  }, []);
  async function loadFavourites() {
    setLoading(true);
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You are not signed in.");
      setLoading(false);
      return;
    }
    const { data, error: favouritesError } = await supabase
      .from("favourites")
      .select("id,user_id,league_id,team_id,player_id")
      .eq("user_id", user.id);
    if (favouritesError) {
      console.error(favouritesError);
      setError("Couldn't load your favourites.");
      setLoading(false);
      return;
    }
    const favourites = (data ?? []) as Favourite[];
    const leagueIds = favourites
      .map((item) => item.league_id)
      .filter((id): id is string => Boolean(id));
    const teamIds = favourites
      .map((item) => item.team_id)
      .filter((id): id is string => Boolean(id));
    const playerIds = favourites
      .map((item) => item.player_id)
      .filter((id): id is string => Boolean(id));
    const [leagues, teams, players] = await Promise.all([
      leagueIds.length
        ? supabase
            .from("leagues")
            .select("id,name")
            .in("id", leagueIds)
        : Promise.resolve({ data: [], error: null }),
      teamIds.length
        ? supabase
            .from("teams")
            .select("id,name")
            .in("id", teamIds)
        : Promise.resolve({ data: [], error: null }),
      playerIds.length
        ? supabase
            .from("players")
            .select("id,username,display_name")
            .in("id", playerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (leagues.error || teams.error || players.error) {
      console.error(
        leagues.error,
        teams.error,
        players.error,
      );
      setError("Couldn't load favourite details.");
      setLoading(false);
      return;
    }
    const leagueItems: Item[] = (leagues.data ?? []).map(
      (league) => ({
        id: league.id,
        name: league.name,
        type: "League",
      }),
    );
    const teamItems: Item[] = (teams.data ?? []).map(
      (team) => ({
        id: team.id,
        name: team.name,
        type: "Team",
      }),
    );
    const playerItems: Item[] = (players.data ?? []).map(
      (player) => ({
        id: player.id,
        name:
          player.display_name ||
          player.username ||
          "Unknown player",
        type: "Player",
      }),
    );
    setItems([
      ...leagueItems,
      ...teamItems,
      ...playerItems,
    ]);
    setLoading(false);
  }
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Your watchlist
          </p>
          <div className="flex items-center gap-3">
            <Heart className="size-7" />
            <h1 className="text-4xl font-bold tracking-tight">
              Favourites
            </h1>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your favourite leagues, teams and players in one place.
          </p>
        </div>
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-xl border bg-card">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-card p-6">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border bg-card px-6 text-center">
            <Star className="mb-4 size-7 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              No favourites yet
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Favourite leagues, teams and players will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="rounded-xl border bg-card p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.type}
                  </span>
                  <Star className="size-4 fill-current" />
                </div>
                <h2 className="mt-4 font-semibold">
                  {item.name}
                </h2>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
