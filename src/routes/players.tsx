import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Player = {
  id: string;
  username: string | null;
  display_name: string | null;
  position: string | null;
  team_id: string | null;
  team?: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
};

export const Route = createFileRoute("/players")({
  component: Players,
});

function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("players")
      .select(`
        id,
        username,
        display_name,
        position,
        team_id,
        team:teams (
          id,
          name,
          logo_url
        )
      `)
      .order("display_name", { ascending: true });

    if (error) {
      console.error("Failed to load players:", error);
      setError("Couldn't load players.");
      setLoading(false);
      return;
    }

    setPlayers((data ?? []) as Player[]);
    setLoading(false);
  }

  const filteredPlayers = players.filter((player) => {
    const query = search.toLowerCase().trim();

    if (!query) return true;

    return (
      player.display_name?.toLowerCase().includes(query) ||
      player.username?.toLowerCase().includes(query) ||
      player.team?.name?.toLowerCase().includes(query) ||
      player.position?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading players...
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
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Player index
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Players
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Browse players registered in NOVA.
          </p>
        </div>

        <div className="mb-6">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search players or teams..."
            className="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
          />
        </div>

        {filteredPlayers.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">
              {search ? "No players found" : "No players available"}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "Try a different player, username, team or position."
                : "Players will appear here when they exist in the connected database."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPlayers.map((player) => (
              <Link
                key={player.id}
                to="/players/$playerId"
                params={{ playerId: player.id }}
                className="block rounded-xl border bg-card p-4 transition hover:bg-accent/40 hover:shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-background">
                    {player.team?.logo_url ? (
                      <img
                        src={player.team.logo_url}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">
                        {(player.display_name ??
                          player.username ??
                          "?")
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">
                      {player.display_name ??
                        player.username ??
                        "Unknown player"}
                    </h2>

                    {player.username &&
                      player.display_name &&
                      player.username !== player.display_name && (
                        <p className="truncate text-xs text-muted-foreground">
                          @{player.username}
                        </p>
                      )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    {player.position ?? "Position not set"}
                  </span>

                  <span className="truncate pl-4 text-xs font-medium">
                    {player.team?.name ?? "Free agent"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
