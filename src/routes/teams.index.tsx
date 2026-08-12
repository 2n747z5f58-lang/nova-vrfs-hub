import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useFavourites } from "@/hooks/useFavourites";
import { listTeams } from "@/lib/nova/api";
import { TeamCard } from "@/components/nova/Cards";
import { EmptyState, PageHeader, SectionHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/teams/")({
  head: () => ({
    meta: [
      { title: "Teams — NOVA VRFS" },
      { name: "description", content: "All NOVA VRFS clubs. Follow teams to pin them to the top of your lists." },
      { property: "og:title", content: "Teams — NOVA VRFS" },
      { property: "og:description", content: "Browse and follow NOVA VRFS teams." },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["teams"], queryFn: () => listTeams() });
  const { idsOf, signedIn } = useFavourites();
  const followed = idsOf("team");
  const teams = data ?? [];
  const following = teams.filter((t) => followed.includes(t.id));
  const others = teams.filter((t) => !followed.includes(t.id));

  return (
    <div className="space-y-5">
      <PageHeader title="Teams" subtitle="Followed teams are pinned to the top" />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading teams…</p>
      ) : teams.length === 0 ? (
        <EmptyState title="No teams available yet." />
      ) : (
        <>
          <section>
            <SectionHeader title="Following" />
            {following.length === 0 ? (
              <EmptyState
                title={signedIn ? "You're not following any teams yet." : "Sign in to follow teams."}
                description="Followed teams are pinned here and drive your match notifications."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {following.map((t) => (
                  <TeamCard key={t.id} team={t} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="Other teams" />
            {others.length === 0 ? (
              <EmptyState title="No other teams." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {others.map((t) => (
                  <TeamCard key={t.id} team={t} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
