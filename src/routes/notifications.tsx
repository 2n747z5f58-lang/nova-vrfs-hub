import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NovaNotification,
} from "@/lib/nova/api";
import { NotificationItem } from "@/components/nova/NotificationItem";
import { EmptyState, PageHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — NOVA VRFS" },
      { name: "description", content: "Your NOVA notification centre: fixtures, goals, results and transfers for your favourites." },
      { property: "og:title", content: "Notifications — NOVA VRFS" },
      { property: "og:description", content: "Favourite-driven NOVA VRFS notifications." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => listNotifications(user!.id),
    enabled: !!user,
  });

  const toggle = useMutation({
    mutationFn: (n: NovaNotification) => markNotificationRead(n.id, !n.read),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  if (!user) {
    return (
      <div>
        <PageHeader title="Notifications" />
        <EmptyState
          title="Sign in to see your notifications."
          description="NOVA notifies you about fixtures, goals, results and transfers involving your favourites."
          action={
            <Link to="/auth" className="mt-2 flex h-9 items-center rounded-sm bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground">
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  const items = data ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread`}
        action={
          unread > 0 ? (
            <button
              onClick={() => readAll.mutate()}
              className="h-9 shrink-0 rounded-sm border border-border px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState
          title="No notifications yet."
          description="Favourite leagues, teams and players — NOVA notifies you when fixtures are released, matches approach, goals are scored and players transfer."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <NotificationItem key={n.id} notification={n} onToggleRead={(x) => toggle.mutate(x)} />
          ))}
        </div>
      )}
    </div>
  );
}
