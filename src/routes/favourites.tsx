import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Loader2, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Favourite = {
  id: string;
  user_id: string;
  item_type: "player" | "team" | "league";
  item_id: string;
  created_at: string;
};

type Item = {
  id: string;
  name: string;
  type: "player" | "team" | "league";
  favouriteId: string;
  avatarUrl?: string | null;
};

export const Route = createFileRoute("/favourites")({
  ssr: false,
  component: Favourites,
});

function Favourites() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
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
      .select("id,user_id,item_type,item_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (favouritesError) {
      console.error("Failed to load favourites:", favouritesError);
      setError("Couldn't load your favourites.");
      setLoading(false);
      return;
    }

    const favourites = (data ?? []) as Favourite[];

    if (favourites.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const playerIds = favourites
      .filter((item) => item.item_type === "player")
      .map((item) => item.item_id);

    const teamIds = favourites
      .filter((item) => item.item_type === "team")
      .map((item) => item.item_id);

    const leagueIds = favourites
      .filter((item) => item.item_type === "league")
      .map((item) => item.item_id);

    const [players, teams, leagues] = await Promise.all([
      playerIds.length
        ? supabase
            .from("players")
            .select("id,name,username,display_name,avatar_url")
            .in("id", playerIds)
        : Promise.resolve({ data: [], error: null }),

      teamIds.length
        ? supabase
            .from("teams")
            .select("id,name,logo_url")
            .in("id", teamIds)
        : Promise.resolve({ data: [], error: null }),

      leagueIds.length
        ? supabase
            .from("leagues")
            .select("id,name,logo_url")
            .in("id", leagueIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (players.error || teams.error || leagues.error) {
      console.error(
        "Failed to load favourite details:",
        players.error,
        teams.error,
        leagues.error,
      );
      setError("Couldn't load favourite details.");
      setLoading(false);
      return;
    }

    const playerItems: Item[] = (players.data ?? []).map((player) => {
      const favourite = favourites.find(
        (item) =>
          item.item_type === "player" && item.item_id === player.id,
      );

      return {
        id: player.id,
        name:
          player.name ||
          player.display_name ||
          player.username ||
          "Unknown player",
        type: "player",
        favouriteId: favourite?.id ?? "",
        avatarUrl: player.avatar_url,
      };
    });

    const teamItems: Item[] = (teams.data ?? []).map((team) => {
      const favourite = favourites.find(
        (item) =>
          item.item_type === "team" && item.item_id === team.id,
      );

      return {
        id: team.id,
        name: team.name,
        type: "team",
        favouriteId: favourite?.id ?? "",
        avatarUrl: team.logo_url,
      };
    });

    const leagueItems: Item[] = (leagues.data ?? []).map((league) => {
      const favourite = favourites.find(
        (item) =>
          item.item_type === "league" && item.item_id === league.id,
      );

      return {
        id: league.id,
        name: league.name,
        type: "league",
        favouriteId: favourite?.id ?? "",
        avatarUrl: league.logo_url,
      };
    });

    const itemMap = new Map(
      [...playerItems, ...teamItems, ...leagueItems].map((item) => [
        `${item.type}-${item.id}`,
        item,
      ]),
    );

    const orderedItems = favourites
      .map((favourite) =>
        itemMap.get(`${favourite.item_type}-${favourite.item_id}`),
      )
      .filter((item): item is Item => Boolean(item));

    setItems(orderedItems);
    setLoading(false);
  }

  async function removeFavourite(item: Item) {
    if (removing) return;

    setRemoving(item.favouriteId);
    setError("");

    const { error: deleteError } = await supabase
      .from("favourites")
      .delete()
      .eq("id", item.favouriteId);

    if (deleteError) {
      console.error("Failed to remove favourite:", deleteError);
      setError("Couldn't remove this favourite.");
      setRemoving(null);
      return;
    }

    setItems((current) =>
      current.filter((existing) => existing.favouriteId !== item.favouriteId),
    );

    setRemoving(null);
  }

  const players = items.filter((item) => item.type === "player");
  const teams = items.filter((item) => item.type === "team");
  const leagues = items.filter((item) => item.type === "league");

  function getProfileRoute(item: Item) {
    if (item.type === "player") {
      return {
        to: "/players/$playerId" as const,
        params: { playerId: item.id },
      };
    }

    if (item.type === "team") {
      return {
        to: "/teams/$teamId" as const,
        params: { teamId: item.id },
      };
    }

    return {
      to: "/leagues/$leagueId" as const,
      params: { leagueId: item.id },
    };
  }

  function renderSection(
    title: string,
    sectionItems: Item[],
  ) {
    if (sectionItems.length === 0) return null;

    return (
      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {sectionItems.length}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sectionItems.map((item) => {
            const profileRoute = getProfileRoute(item);

            return (
              <div
                key={`${item.type}-${item.id}`}
                className="group rounded-xl border bg-card p-5 transition hover:border-foreground/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <Link
                    to={profileRoute.to}
                    params={profileRoute.params}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-3">
                      {item.avatarUrl ? (
                        <img
                          src={item.avatarUrl}
                          alt=""
                          className="size-11 rounded-full object-contain"
                        />
                      ) : (
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-muted">
                          <Star className="size-5 text-muted-foreground" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="truncate font-semibold group-hover:underline">
                          {item.name}
                        </p>

                        <p className="mt-1 text-xs capitalize text-muted-foreground">
                          {item.type}
                        </p>
                      </div>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => void removeFavourite(item)}
                    disabled={removing === item.favouriteId}
                    title="Remove favourite"
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {removing === item.favouriteId ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
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
        </header>

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
              Favourite leagues, teams and players and they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {renderSection("Players", players)}
            {renderSection("Teams", teams)}
            {renderSection("Leagues", leagues)}
          </div>
        )}
      </div>
    </main>
  );
}
