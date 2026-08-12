import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPlayer, getPlayerStats, listResults, listTransfers, listUpcomingFixtures } from "@/lib/nova/api";
import { FavouriteButton } from "@/components/nova/FavouriteButton";
import { MatchCard } from "@/components/nova/Cards";
import { EmptyState, PageHeader, SectionHeader } from "@/components/nova/Primitives";
import { shortDate } from "@/lib/nova/dates";

export const Route = createFileRoute("/players/$playerId")({
  head: () => ({
    meta: [
      { title: "Player — NOVA VRFS" },
      { name: "description", content: "NOVA VRFS player profile: team, position, appearances, goals and assists." },
      { property: "og:title", content: "Player — NOVA VRFS" },
      { property: "og:description", content: "Profile and statistics for this NOVA VRFS player." },
    ],
  }),
  component: PlayerPage,
});

function PlayerPage() {
  const { playerId } = Route.useParams();
  const player = useQuery({ queryKey: ["player", playerId], queryFn: () => getPlayer(playerId) });
  const stats = useQuery({ queryKey: ["player-stats", playerId], queryFn: () => getPlayerStats(playerId) });
  const transfers = useQuery({ queryKey: ["transfers", playerId], queryFn: () => listTransfers(playerId) });
  const teamId = player.data?.team_id ?? undefined;
  const fixtures = useQuery({
    queryKey: ["team-fixtures", teamId],
    queryFn: () => listUpcomingFixtures(5, { teamId: teamId! }),
    enabled: !!teamId,
  });
  const results = useQuery({
    queryKey: ["team-results", teamId],
    queryFn: () => listResults(5, { teamId: teamId! }),
    enabled: !!teamId,
  });

  if (player.isLoading) return <p className="text-sm text-muted-foreground">Loading player…</p>;
  if (!player.data) return <EmptyState title="Player not found." />;
  const p = player.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={p.username}
        subtitle={`${p.display_name ?? "VRFS player"} · ${p.position ?? "Position TBC"}`}
        action={<FavouriteButton type="player" itemId={p.id} size="icon" />}
      />

      <div className="nova-panel space-y-2 px-3 py-3 text-sm">
        <p className="text-muted-foreground">
          Team:{" "}
          {p.teams ? (
            <Link to="/teams/$slug" params={{ slug: p.teams.slug }} className="font-semibold text-foreground hover:underline">
              {p.teams.name}
            </Link>
          ) : (
            "Free agent"
          )}
        </p>
        <p className="text-muted-foreground">Discord: {p.discord_username ?? "Not connected"}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Appearances", value: stats.data?.appearances ?? 0 },
          { label: "Goals", value: stats.data?.goals ?? 0 },
          { label: "Assists", value: stats.data?.assists ?? 0 },
        ].map((s) => (
          <div key={s.label} className="nova-panel px-3 py-3 text-center">
            <p className="text-2xl font-black tabular-nums">{s.value}</p>
            <p className="nova-label">{s.label}</p>
          </div>
        ))}
      </div>

      <section>
        <SectionHeader title="Upcoming matches" />
        {(fixtures.data ?? []).length === 0 ? (
          <EmptyState title="No upcoming matches." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {fixtures.data!.map((f) => <MatchCard key={f.id} fixture={f} showDate />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Recent results" />
        {(results.data ?? []).length === 0 ? (
          <EmptyState title="No results yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {results.data!.map((f) => <MatchCard key={f.id} fixture={f} showDate />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Transfer history" />
        {(transfers.data ?? []).length === 0 ? (
          <EmptyState title="No transfers recorded." />
        ) : (
          <div className="space-y-2">
            {transfers.data!.map((t) => (
              <div key={t.id} className="nova-panel px-3 py-2.5 text-sm">
                <p className="font-semibold">
                  {t.from_team?.name ?? "Free agent"} → {t.to_team?.name ?? "Free agent"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {shortDate(t.transfer_date)}
                  {t.details ? ` · ${t.details}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
