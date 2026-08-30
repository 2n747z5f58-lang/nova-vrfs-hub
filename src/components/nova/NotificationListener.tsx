import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  viewed: boolean;
  created_at: string;
};

export function NotificationListener() {
  const [notification, setNotification] = useState<Notification | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function startListener() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotification(payload.new as Notification);
          },
        )
        .subscribe();
    }

    void startListener();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  if (!notification) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] w-[calc(100vw-2.5rem)] max-w-sm animate-in slide-in-from-right-5 fade-in duration-300">
      <div className="rounded-xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bell className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{notification.title}</p>

            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {notification.message}
            </p>

            <button
              onClick={() => setNotification(null)}
              className="mt-3 text-xs font-semibold text-foreground underline underline-offset-4"
            >
              View notification
            </button>
          </div>

          <button
            aria-label="Dismiss notification"
            onClick={() => setNotification(null)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
