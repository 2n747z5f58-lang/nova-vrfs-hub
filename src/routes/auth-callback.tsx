import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth-callback")({
  ssr: false,
  component: AuthCallback,
});

function AuthCallback() {
  return <div>Signing you in...</div>;
}
