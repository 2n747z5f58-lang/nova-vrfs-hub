import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listPlayers } from "@/lib/nova/api";
import { PlayerCard } from "@/components/nova/Cards";
import { EmptyState, PageHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/players/")({
  head: () => ({
    meta: [
      { title: "Players — NOVA VRFS" },
      { name: "description", content: "Search NOVA VRFS players, view profiles, teams and statistics." },
      { property: "og:title", content: "Players — NOVA VRFS" },
      { property: "og:description", content: "Search and follow NOVA VRFS players." },
    ],
  }),
  component: PlayersPage,
});

function PlayersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["players", search],
    queryFn: () => listPlayers(search ? { search } : {}),
  });
  const players = data ?? [];

  return (
    <div>
      <PageHeader title="Players" subtitle="NOVA VRFS player directory" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players…"
        className="mb-4 h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-border-strong"
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading players…</p>
      ) : players.length === 0 ? (
        <EmptyState title="No players found." description="Try a different search term." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => <PlayerCard key={p.id} player={p} />)}
        </div>
      )}
    </div>
  );
}
