import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useFavourites } from "@/hooks/useFavourites";
import { listNotifications, listResults, listUpcomingFixtures } from "@/lib/nova/api";
import { MatchCard } from "@/components/nova/Cards";
import { NotificationItem } from "@/components/nova/NotificationItem";
import { EmptyState, PageHeader, SectionHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NOVA VRFS" },
      { name: "description", content: "Your NOVA dashboard: favourite fixtures, recent results and latest notifications." },
      { property: "og:title", content: "Dashboard — NOVA VRFS" },
      { property: "og:description", content: "Your personalised NOVA VRFS dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, profile } = useAuth();
  const { idsOf } = useFavourites();
  const upcoming = useQuery({ queryKey: ["home-upcoming"], queryFn: () => listUpcomingFixtures(20) });
  const results = useQuery({ queryKey: ["home-results"], queryFn: () => listResults(6) });
  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => listNotifications(user!.id),
    enabled: !!user,
  });

  const teamIds = idsOf("team");
  const mine = (upcoming.data ?? []).filter(
    (f) => teamIds.includes(f.home_team_id ?? "") || teamIds.includes(f.away_team_id ?? ""),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle={user ? (profile?.display_name ?? profile?.username ?? user.email ?? "") : "Sign in for a personalised view"}
      />

      {!user && (
        <EmptyState
          title="Sign in to personalise your dashboard."
          action={
            <Link to="/auth" className="mt-2 flex h-9 items-center rounded-sm bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground">
              Sign in
            </Link>
          }
        />
      )}

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Fav leagues", value: idsOf("league").length },
          { label: "Fav teams", value: idsOf("team").length },
          { label: "Fav players", value: idsOf("player").length },
        ].map((s) => (
          <div key={s.label} className="nova-panel px-3 py-3 text-center">
            <p className="text-2xl font-black tabular-nums">{s.value}</p>
            <p className="nova-label">{s.label}</p>
          </div>
        ))}
      </div>

      <section>
        <SectionHeader title="Your next matches" />
        {mine.length === 0 ? (
          <EmptyState title="No matches for your followed teams." description="Follow teams to see their fixtures here." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {mine.map((f) => <MatchCard key={f.id} fixture={f} showDate favourited />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Latest results" />
        {(results.data ?? []).length === 0 ? (
          <EmptyState title="No results yet." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {results.data!.map((f) => <MatchCard key={f.id} fixture={f} showDate />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Recent notifications"
          action={<Link to="/notifications" className="text-xs text-muted-foreground">View all</Link>}
        />
        {(notifications.data ?? []).length === 0 ? (
          <EmptyState title="No notifications yet." />
        ) : (
          <div className="space-y-2">
            {notifications.data!.slice(0, 5).map((n) => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
