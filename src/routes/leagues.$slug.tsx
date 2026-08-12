import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getLeagueBySlug,
  listDivisions,
  listResults,
  listStandings,
  listTeams,
  listUpcomingFixtures,
} from "@/lib/nova/api";
import { FavouriteButton } from "@/components/nova/FavouriteButton";
import { MatchCard, TeamCard, TeamCrest } from "@/components/nova/Cards";
import { StandingsTable } from "@/components/nova/StandingsTable";
import { EmptyState, PageHeader, SectionHeader } from "@/components/nova/Primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leagues/$slug")({
  head: () => ({
    meta: [
      { title: "League — NOVA VRFS" },
      { name: "description", content: "NOVA VRFS league overview: standings, fixtures, results, teams and statistics." },
      { property: "og:title", content: "League — NOVA VRFS" },
      { property: "og:description", content: "Standings, fixtures, results and teams for this NOVA VRFS league." },
    ],
  }),
  component: LeaguePage,
});

const TABS = ["Overview", "Standings", "Fixtures", "Results", "Teams", "Statistics"] as const;

function LeaguePage() {
  const { slug } = Route.useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  const league = useQuery({ queryKey: ["league", slug], queryFn: () => getLeagueBySlug(slug) });
  const leagueId = league.data?.id;

  const divisions = useQuery({
    queryKey: ["divisions", leagueId],
    queryFn: () => listDivisions(leagueId!),
    enabled: !!leagueId,
  });
  const teams = useQuery({
    queryKey: ["teams", leagueId],
    queryFn: () => listTeams(leagueId!),
    enabled: !!leagueId,
  });
  const fixtures = useQuery({
    queryKey: ["league-fixtures", leagueId],
    queryFn: () => listUpcomingFixtures(20, { leagueId: leagueId! }),
    enabled: !!leagueId,
  });
  const results = useQuery({
    queryKey: ["league-results", leagueId],
    queryFn: () => listResults(20, { leagueId: leagueId! }),
    enabled: !!leagueId,
  });
  const standings = useQuery({
    queryKey: ["standings-all"],
    queryFn: () => listStandings(),
  });

  if (league.isLoading) return <p className="text-sm text-muted-foreground">Loading league…</p>;
  if (!league.data) return <EmptyState title="League not found." />;

  const l = league.data;
  const divisionList = divisions.data ?? [];
  const rows = standings.data ?? [];

  return (
    <div>
      <PageHeader
        title={l.name}
        subtitle={`${l.season ?? "VRFS competition"} · ${divisionList.length} division${divisionList.length === 1 ? "" : "s"}`}
        action={<FavouriteButton type="league" itemId={l.id} size="icon" />}
      />

      <div className="no-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-wider",
              tab === t
                ? "border-foreground bg-surface-2 text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="space-y-5">
          <div className="nova-panel flex items-start gap-3 px-3 py-3">
            <TeamCrest name={l.name} logoUrl={l.logo_url} size={44} />
            <p className="text-sm text-muted-foreground">
              {l.description ?? "No description provided yet."}
            </p>
          </div>
          <section>
            <SectionHeader title="Divisions" />
            {divisionList.length === 0 ? (
              <EmptyState title="No divisions created yet." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {divisionList.map((d) => (
                  <div key={d.id} className="nova-panel px-3 py-2.5">
                    <p className="text-sm font-bold">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Tier {d.tier} ·{" "}
                      {(teams.data ?? []).filter((t) => t.division_id === d.id).length} teams
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section>
            <SectionHeader title="Next fixtures" />
            {(fixtures.data ?? []).length === 0 ? (
              <EmptyState title="No fixtures released yet." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {fixtures.data!.slice(0, 4).map((f) => (
                  <MatchCard key={f.id} fixture={f} showDate />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "Standings" && (
        <div className="space-y-5">
          {divisionList.length === 0 ? (
            <EmptyState title="No standings yet." />
          ) : (
            divisionList.map((d) => (
              <section key={d.id}>
                <SectionHeader title={d.name} />
                <StandingsTable rows={rows.filter((r) => r.division_id === d.id)} />
              </section>
            ))
          )}
        </div>
      )}

      {tab === "Fixtures" &&
        ((fixtures.data ?? []).length === 0 ? (
          <EmptyState title="No fixtures released yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {fixtures.data!.map((f) => (
              <MatchCard key={f.id} fixture={f} showDate />
            ))}
          </div>
        ))}

      {tab === "Results" &&
        ((results.data ?? []).length === 0 ? (
          <EmptyState title="No results yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {results.data!.map((f) => (
              <MatchCard key={f.id} fixture={f} showDate />
            ))}
          </div>
        ))}

      {tab === "Teams" &&
        ((teams.data ?? []).length === 0 ? (
          <EmptyState title="No teams available yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {teams.data!.map((t) => (
              <TeamCard key={t.id} team={t} />
            ))}
          </div>
        ))}

      {tab === "Statistics" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Teams", value: (teams.data ?? []).length },
            { label: "Divisions", value: divisionList.length },
            { label: "Matches played", value: (results.data ?? []).length },
            {
              label: "Goals scored",
              value: (results.data ?? []).reduce(
                (sum, f) => sum + (f.home_score ?? 0) + (f.away_score ?? 0),
                0,
              ),
            },
          ].map((s) => (
            <div key={s.label} className="nova-panel px-3 py-3">
              <p className="nova-label">{s.label}</p>
              <p className="mt-1 text-2xl font-black tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
