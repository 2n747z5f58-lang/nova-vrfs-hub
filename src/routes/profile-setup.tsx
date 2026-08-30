import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile-setup")({
  ssr: false,
  component: ProfileSetup,
});

function ProfileSetup() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function saveProfile() {
    setError("");

    if (!username.trim() || !displayName.trim()) {
      setError("Please enter a username and display name.");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You are not signed in.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        username: username.trim(),
        display_name: displayName.trim(),
      });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-10 flex items-center gap-3">
          <span className="grid size-10 place-items-center bg-primary text-primary-foreground font-black">
            N
          </span>
          <span className="font-black tracking-[0.28em]">NOVA</span>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Welcome to NOVA
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Set up your profile.
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Choose how you'll appear across NOVA.
        </p>

        <div className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium"
            >
              Username
            </label>

            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourusername"
              className="h-12 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none focus:border-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="displayName"
              className="mb-2 block text-sm font-medium"
            >
              Display name
            </label>

            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Display Name"
              className="h-12 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none focus:border-foreground"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            onClick={saveProfile}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Continue to NOVA"}
          </button>
        </div>
      </div>
    </main>
  );
}
