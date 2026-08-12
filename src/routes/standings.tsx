import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDivisions, listLeagues, listStandings } from "@/lib/nova/api";
import { StandingsTable } from "@/components/nova/StandingsTable";
import { EmptyState, PageHeader, SectionHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/standings")({
  head: () => ({
    meta: [
      { title: "Standings — NOVA VRFS" },
      { name: "description", content: "NOVA VRFS league tables with played, won, drawn, lost, goals and points." },
      { property: "og:title", content: "Standings — NOVA VRFS" },
      { property: "og:description", content: "Live NOVA VRFS league tables by division." },
    ],
  }),
  component: StandingsPage,
});

function StandingsPage() {
  const leagues = useQuery({ queryKey: ["leagues"], queryFn: listLeagues });
  const divisions = useQuery({ queryKey: ["divisions"], queryFn: () => listDivisions() });
  const standings = useQuery({ queryKey: ["standings-all"], queryFn: () => listStandings() });

  const divisionList = divisions.data ?? [];
  const rows = standings.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title="Standings" subtitle="Calculated automatically from recorded results" />
      {divisionList.length === 0 ? (
        <EmptyState title="No divisions available yet." />
      ) : (
        divisionList.map((d) => {
          const league = (leagues.data ?? []).find((l) => l.id === d.league_id);
          return (
            <section key={d.id}>
              <SectionHeader title={`${league?.name ?? "League"} · ${d.name}`} />
              <StandingsTable rows={rows.filter((r) => r.division_id === d.id)} />
            </section>
          );
        })
      )}
    </div>
  );
}
