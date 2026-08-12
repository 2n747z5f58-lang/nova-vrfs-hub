import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getTeamBySlug, listPlayers, listResults, listStaff, listUpcomingFixtures } from "@/lib/nova/api";
import { FavouriteButton } from "@/components/nova/FavouriteButton";
import { MatchCard, PlayerCard, TeamCrest } from "@/components/nova/Cards";
import { EmptyState, PageHeader, SectionHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/teams/$slug")({
  head: () => ({
    meta: [
      { title: "Team — NOVA VRFS" },
      { name: "description", content: "NOVA VRFS team profile: squad, staff, fixtures, results and statistics." },
      { property: "og:title", content: "Team — NOVA VRFS" },
      { property: "og:description", content: "Squad, fixtures, results and statistics for this NOVA VRFS team." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { slug } = Route.useParams();
  const team = useQuery({ queryKey: ["team", slug], queryFn: () => getTeamBySlug(slug) });
  const id = team.data?.id;
  const squad = useQuery({ queryKey: ["players", "team", id], queryFn: () => listPlayers({ teamId: id! }), enabled: !!id });
  const staff = useQuery({ queryKey: ["staff", id], queryFn: () => listStaff(id!), enabled: !!id });
  const fixtures = useQuery({ queryKey: ["team-fixtures", id], queryFn: () => listUpcomingFixtures(10, { teamId: id! }), enabled: !!id });
  const results = useQuery({ queryKey: ["team-results", id], queryFn: () => listResults(10, { teamId: id! }), enabled: !!id });

  if (team.isLoading) return <p className="text-sm text-muted-foreground">Loading team…</p>;
  if (!team.data) return <EmptyState title="Team not found." />;
  const t = team.data;
  const played = results.data ?? [];
  const wins = played.filter((f) =>
    f.home_team_id === t.id ? (f.home_score ?? 0) > (f.away_score ?? 0) : (f.away_score ?? 0) > (f.home_score ?? 0),
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.name}
        subtitle={`${t.leagues?.name ?? "Unassigned"}${t.divisions?.name ? ` · ${t.divisions.name}` : ""}`}
        action={<FavouriteButton type="team" itemId={t.id} label="Follow" />}
      />

      <div className="nova-panel flex items-center gap-3 px-3 py-3">
        <TeamCrest name={t.name} logoUrl={t.logo_url} size={48} />
        <div className="grid flex-1 grid-cols-3 gap-2 text-center">
          {[
            { label: "Played", value: played.length },
            { label: "Won", value: wins },
            { label: "Squad", value: (squad.data ?? []).length },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xl font-black tabular-nums">{s.value}</p>
              <p className="nova-label">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section>
        <SectionHeader title="Upcoming fixtures" />
        {(fixtures.data ?? []).length === 0 ? (
          <EmptyState title="No upcoming fixtures." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {fixtures.data!.map((f) => <MatchCard key={f.id} fixture={f} showDate />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Results" />
        {played.length === 0 ? (
          <EmptyState title="No results yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {played.map((f) => <MatchCard key={f.id} fixture={f} showDate />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Squad" />
        {(squad.data ?? []).length === 0 ? (
          <EmptyState title="No players registered yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {squad.data!.map((p) => <PlayerCard key={p.id} player={p} />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Staff" />
        {(staff.data ?? []).length === 0 ? (
          <EmptyState title="No staff listed yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {staff.data!.map((s) => (
              <div key={s.id} className="nova-panel px-3 py-2.5">
                <p className="text-sm font-bold">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.role}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
