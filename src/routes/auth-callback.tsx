import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth-callback")({
  ssr: false,

  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw redirect({ to: "/auth" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile?.username || !profile?.display_name) {
      throw redirect({ to: "/profile-setup" });
    }

    throw redirect({ to: "/" });
  },

  component: () => null,
});
