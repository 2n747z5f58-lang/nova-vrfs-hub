import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listResults } from "@/lib/nova/api";
import { MatchCard } from "@/components/nova/Cards";
import { EmptyState, PageHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Results — NOVA VRFS" },
      { name: "description", content: "Completed NOVA VRFS matches with final scores, competition and division." },
      { property: "og:title", content: "Results — NOVA VRFS" },
      { property: "og:description", content: "Every completed NOVA VRFS match result." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["results-all"], queryFn: () => listResults(60) });
  const results = data ?? [];

  return (
    <div>
      <PageHeader title="Results" subtitle="Completed NOVA VRFS matches" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading results…</p>
      ) : results.length === 0 ? (
        <EmptyState title="No results yet." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {results.map((f) => <MatchCard key={f.id} fixture={f} showDate />)}
        </div>
      )}
    </div>
  );
}
