import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Completes the Discord OAuth round-trip. Supabase redirects here with a
// `?code=...` param; exchange it for a session, then route the user home
// (or back to sign-in if the exchange failed).
export const Route = createFileRoute("/auth-callback")({ ssr: false, component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
      void navigate({ to: error ? ("/auth" as any) : ("/" as any) });
    });
  }, [navigate]);
  return null;
}
