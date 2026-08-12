import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listLeagues } from "@/lib/nova/api";
import { LeagueCard } from "@/components/nova/Cards";
import { EmptyState, PageHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/leagues/")({
  head: () => ({
    meta: [
      { title: "Leagues — NOVA VRFS" },
      { name: "description", content: "Every NOVA VRFS league and competition, with divisions, fixtures and standings." },
      { property: "og:title", content: "Leagues — NOVA VRFS" },
      { property: "og:description", content: "Browse NOVA VRFS leagues, divisions and competitions." },
    ],
  }),
  component: LeaguesPage,
});

function LeaguesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["leagues"], queryFn: listLeagues });
  const leagues = data ?? [];

  return (
    <div>
      <PageHeader title="Leagues" subtitle="NOVA VRFS competitions" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading leagues…</p>
      ) : leagues.length === 0 ? (
        <EmptyState title="No leagues available yet." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {leagues.map((l) => (
            <LeagueCard key={l.id} league={l} />
          ))}
        </div>
      )}
    </div>
  );
}
