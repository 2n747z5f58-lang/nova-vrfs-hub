import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import novaMark from "@/assets/nova-mark.asset.json";
import { useAuth } from "@/hooks/useAuth";
import { useFavourites } from "@/hooks/useFavourites";
import {
  listLeagues,
  listPlayers,
  listResults,
  listTeams,
  listUpcomingFixtures,
} from "@/lib/nova/api";
import { LeagueCard, MatchCard, PlayerCard, TeamCard } from "@/components/nova/Cards";
import { EmptyState, SectionHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NOVA — Competitive VRFS League Platform" },
      {
        name: "description",
        content:
          "NOVA is the home of competitive VRFS: match days, fixtures, results, standings, teams and player stats.",
      },
      { property: "og:title", content: "NOVA — Competitive VRFS League Platform" },
      {
        property: "og:description",
        content: "Match days, fixtures, results, standings, teams and player stats for NOVA VRFS.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = useAuth();
  const { idsOf } = useFavourites();
  const upcoming = useQuery({ queryKey: ["home-upcoming"], queryFn: () => listUpcomingFixtures(5) });
  const results = useQuery({ queryKey: ["home-results"], queryFn: () => listResults(4) });
  const leagues = useQuery({ queryKey: ["leagues"], queryFn: listLeagues });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => listTeams() });
  const players = useQuery({ queryKey: ["players", ""], queryFn: () => listPlayers() });

  const favTeams = idsOf("team");
  const favFixtures = (upcoming.data ?? []).filter(
    (f) => favTeams.includes(f.home_team_id ?? "") || favTeams.includes(f.away_team_id ?? ""),
  );

  return (
    <div className="space-y-8">
      <section className="nova-panel relative overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-3">
          <img
            src={novaMark.url}
            alt="NOVA logo"
            className="h-14 w-14 rounded-sm border border-border object-cover"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-[0.18em] sm:text-3xl">NOVA</h1>
            <p className="nova-label">Virtual Reality Football Simulator</p>
          </div>
        </div>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">
          NOVA is the competitive VRFS league platform. Follow every match day, track fixtures and
          results, dig into standings, and favourite the leagues, teams and players you care about.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/matches"
            className="flex h-10 items-center gap-2 rounded-sm bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground"
          >
            Match days <ArrowRight className="h-4 w-4" />
          </Link>
          {!user && (
            <Link
              to="/auth"
              className="flex h-10 items-center rounded-sm border border-border-strong px-4 text-xs font-bold uppercase tracking-wider"
            >
              Sign in / Connect Discord
            </Link>
          )}
          <Link
            to="/standings"
            className="flex h-10 items-center rounded-sm border border-border px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Standings
          </Link>
        </div>
      </section>

      {user && (
        <section>
          <SectionHeader
            title="Your favourites"
            action={
              <Link to="/favourites" className="text-xs font-semibold text-muted-foreground">
                View all
              </Link>
            }
          />
          {favFixtures.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {favFixtures.map((f) => (
                <MatchCard key={f.id} fixture={f} showDate favourited />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No favourite fixtures coming up."
              description="Favourite leagues, teams and players to see their matches and get notifications here."
            />
          )}
        </section>
      )}

      <section>
        <SectionHeader
          title="Upcoming matches"
          action={
            <Link to="/matches" className="text-xs font-semibold text-muted-foreground">
              All match days
            </Link>
          }
        />
        {(upcoming.data ?? []).length === 0 ? (
          <EmptyState title="No upcoming matches scheduled." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {upcoming.data!.map((f) => (
              <MatchCard key={f.id} fixture={f} showDate />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Recent results"
          action={
            <Link to="/results" className="text-xs font-semibold text-muted-foreground">
              All results
            </Link>
          }
        />
        {(results.data ?? []).length === 0 ? (
          <EmptyState title="No results yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {results.data!.map((f) => (
              <MatchCard key={f.id} fixture={f} showDate />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Featured leagues"
          action={
            <Link to="/leagues" className="text-xs font-semibold text-muted-foreground">
              All leagues
            </Link>
          }
        />
        {(leagues.data ?? []).length === 0 ? (
          <EmptyState title="No leagues available yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {leagues.data!.slice(0, 4).map((l) => (
              <LeagueCard key={l.id} league={l} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Featured teams"
          action={
            <Link to="/teams" className="text-xs font-semibold text-muted-foreground">
              All teams
            </Link>
          }
        />
        {(teams.data ?? []).length === 0 ? (
          <EmptyState title="No teams available yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {teams.data!.slice(0, 6).map((t) => (
              <TeamCard key={t.id} team={t} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Featured players"
          action={
            <Link to="/players" className="text-xs font-semibold text-muted-foreground">
              All players
            </Link>
          }
        />
        {(players.data ?? []).length === 0 ? (
          <EmptyState title="No players available yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {players.data!.slice(0, 6).map((p) => (
              <PlayerCard key={p.id} player={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
