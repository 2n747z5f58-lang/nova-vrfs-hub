import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useFavourites } from "@/hooks/useFavourites";
import { listLeagues, listPlayers, listTeams, listUpcomingFixtures } from "@/lib/nova/api";
import { LeagueCard, MatchCard, PlayerCard, TeamCard } from "@/components/nova/Cards";
import { EmptyState, PageHeader, SectionHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/favourites")({
  head: () => ({
    meta: [
      { title: "Favourites — NOVA VRFS" },
      { name: "description", content: "Your favourite NOVA VRFS leagues, teams and players in one place." },
      { property: "og:title", content: "Favourites — NOVA VRFS" },
      { property: "og:description", content: "Your favourite NOVA VRFS leagues, teams and players." },
    ],
  }),
  component: FavouritesPage,
});

function FavouritesPage() {
  const { user } = useAuth();
  const { idsOf } = useFavourites();
  const leagues = useQuery({ queryKey: ["leagues"], queryFn: listLeagues });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => listTeams() });
  const players = useQuery({ queryKey: ["players", ""], queryFn: () => listPlayers() });
  const upcoming = useQuery({ queryKey: ["home-upcoming"], queryFn: () => listUpcomingFixtures(20) });

  if (!user) {
    return (
      <div>
        <PageHeader title="Favourites" />
        <EmptyState
          title="Sign in to use favourites."
          description="Favourite leagues, teams and players to pin them here and receive notifications."
          action={
            <Link to="/auth" className="mt-2 flex h-9 items-center rounded-sm bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground">
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  const favLeagues = (leagues.data ?? []).filter((l) => idsOf("league").includes(l.id));
  const favTeams = (teams.data ?? []).filter((t) => idsOf("team").includes(t.id));
  const favPlayers = (players.data ?? []).filter((p) => idsOf("player").includes(p.id));
  const teamIds = favTeams.map((t) => t.id);
  const leagueIds = favLeagues.map((l) => l.id);
  const matches = (upcoming.data ?? []).filter(
    (f) =>
      teamIds.includes(f.home_team_id ?? "") ||
      teamIds.includes(f.away_team_id ?? "") ||
      leagueIds.includes(f.league_id ?? ""),
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Favourites" subtitle="Your leagues, teams and players" />

      <section>
        <SectionHeader title="Upcoming for your favourites" />
        {matches.length === 0 ? (
          <EmptyState title="No upcoming matches for your favourites." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {matches.map((f) => <MatchCard key={f.id} fixture={f} showDate favourited />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Leagues" />
        {favLeagues.length === 0 ? (
          <EmptyState title="No favourite leagues yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {favLeagues.map((l) => <LeagueCard key={l.id} league={l} />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Teams" />
        {favTeams.length === 0 ? (
          <EmptyState title="No favourite teams yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {favTeams.map((t) => <TeamCard key={t.id} team={t} />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Players" />
        {favPlayers.length === 0 ? (
          <EmptyState title="No favourite players yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {favPlayers.map((p) => <PlayerCard key={p.id} player={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
