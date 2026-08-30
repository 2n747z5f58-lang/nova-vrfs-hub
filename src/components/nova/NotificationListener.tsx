import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function NotificationListener() {
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
            console.log("New NOVA notification:", payload.new);
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

  return null;
}
