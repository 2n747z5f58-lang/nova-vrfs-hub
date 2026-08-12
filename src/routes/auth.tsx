import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — NOVA VRFS" },
      { name: "description", content: "Sign in to NOVA to favourite leagues, teams and players." },
      { property: "og:title", content: "Sign in — NOVA VRFS" },
      { property: "og:description", content: "Sign in to NOVA to follow VRFS teams and players." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [discordNote, setDiscordNote] = useState<string | null>(null);

  async function handleDiscord() {
    setBusy(true);
    setDiscordNote(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      setDiscordNote(
        "Discord sign-in is not configured yet. A Discord application (client ID + client secret) must be added to the backend auth settings before this button can work — nothing is faked here.",
      );
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Account created. Check your email to confirm, then sign in.");
      setMode("signin");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    navigate({ to: "/dashboard" });
  }

  if (user) {
    return (
      <div className="mx-auto max-w-md">
        <PageHeader title="Signed in" subtitle={user.email ?? undefined} />
        <p className="text-sm text-muted-foreground">
          You're signed in. Head to your dashboard or profile.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Sign in to NOVA" subtitle="Discord is the intended NOVA identity provider" />

      <button
        onClick={() => void handleDiscord()}
        disabled={busy}
        className="mb-3 flex h-11 w-full items-center justify-center rounded-sm bg-primary text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-60"
      >
        Continue with Discord
      </button>
      {discordNote && (
        <p className="mb-4 rounded-sm border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          {discordNote}
        </p>
      )}

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="nova-label">or email</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmail} className="space-y-3">
        <div>
          <label className="nova-label mb-1 block" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-border-strong"
          />
        </div>
        <div>
          <label className="nova-label mb-1 block" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-border-strong"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-sm border border-border-strong text-sm font-bold uppercase tracking-wider disabled:opacity-60"
        >
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-4 w-full text-xs text-muted-foreground underline"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>

      <p className="mt-6 text-xs text-muted-foreground">
        Discord OAuth requires a Discord application to be configured in the backend auth settings
        (Discord client ID and client secret, with the backend callback URL added as a redirect in
        the Discord developer portal). Secrets are never stored in this frontend.
      </p>
    </div>
  );
}
