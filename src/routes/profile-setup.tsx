import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile-setup")({
  ssr: false,
  component: ProfileSetup,
});

function ProfileSetup() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !displayName.trim()) {
      setError("Please fill in your username and display name.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate({ to: "/auth" });
        return;
      }

      let avatarUrl: string | null = null;

      if (avatar) {
        const fileExt = avatar.name.split(".").pop();
        const filePath = `${user.id}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatar, {
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        avatarUrl = data.publicUrl;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          username: username.trim(),
          display_name: displayName.trim(),
          avatar_url: avatarUrl,
        });

      if (profileError) throw profileError;

      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6"
      >
        <h1 className="text-3xl font-bold">Set up your NOVA profile</h1>

        <p className="mt-2 text-sm text-zinc-400">
          Finish your profile before entering NOVA.
        </p>

        <div className="mt-6 space-y-4">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 outline-none"
          />

          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 outline-none"
          />

          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Profile picture
            </label>

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-black disabled:opacity-50"
          >
            {loading ? "Saving..." : "Continue to NOVA"}
          </button>
        </div>
      </form>
    </main>
  );
}
