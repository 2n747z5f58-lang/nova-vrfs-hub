import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  viewed: boolean;
  created_at: string;
};

export const Route = createFileRoute("/notifications")({
  ssr: false,
  component: Notifications,
});

function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadNotifications() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setNotifications(data as Notification[]);
      }

      channel = supabase
        .channel(`notifications-page-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((current) => [
              payload.new as Notification,
              ...current,
            ]);
          },
        )
        .subscribe();

      setLoading(false);
    }

    void loadNotifications();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  async function markAsViewed(notification: Notification) {
    if (notification.viewed) return;

    await supabase
      .from("notifications")
      .update({ viewed: true })
      .eq("id", notification.id);

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, viewed: true }
          : item,
      ),
    );
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.viewed,
  ).length;

  return (
    <div className="nova-page min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <div className="min-w-0 flex-1">
          <main className="mx-auto max-w-[1000px] px-5 py-8 lg:px-10">
            <div className="mb-10">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Activity feed
              </p>

              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold tracking-[-0.04em] md:text-5xl">
                  Notifications
                </h1>

                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Stay informed about fixtures, results, league updates and
                activity across NOVA.
              </p>
            </div>

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center border border-border bg-card">
                <p className="text-sm text-muted-foreground">
                  Loading notifications...
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center border border-border bg-card px-6 text-center">
                <div className="mb-5 grid size-14 place-items-center border border-dashed border-border text-muted-foreground">
                  <Bell className="size-5" />
                </div>

                <h2 className="text-lg font-semibold">No notifications</h2>

                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  New updates from NOVA will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void markAsViewed(notification)}
                    className={`w-full border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent ${
                      notification.viewed
                        ? "border-border bg-card"
                        : "border-primary/30 bg-card shadow-sm"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg ${
                          notification.viewed
                            ? "border border-border text-muted-foreground"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        {notification.viewed ? (
                          <Check className="size-4" />
                        ) : (
                          <Bell className="size-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="font-semibold">
                            {notification.title}
                          </h2>

                          <span className="text-xs text-muted-foreground">
                            {notification.viewed ? "Viewed" : "New"}
                          </span>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {notification.message}
                        </p>

                        <p className="mt-3 text-xs text-muted-foreground">
                          {new Date(
                            notification.created_at,
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
