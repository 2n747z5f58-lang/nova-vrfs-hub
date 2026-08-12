import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile } from "@/lib/nova/api";
import { EmptyState, PageHeader, SectionHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — NOVA VRFS" },
      { name: "description", content: "Manage your NOVA profile, Discord connection and notification preferences." },
      { property: "og:title", content: "Profile — NOVA VRFS" },
      { property: "og:description", content: "Manage your NOVA VRFS profile and preferences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, roles, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    setUsername(profile?.username ?? "");
    setDisplayName(profile?.display_name ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      updateProfile(user!.id, {
        username: username || null,
        display_name: displayName || null,
        avatar_url: avatarUrl || null,
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div>
        <PageHeader title="Profile" />
        <EmptyState
          title="Sign in to view your profile."
          action={
            <Link to="/auth" className="mt-2 flex h-9 items-center rounded-sm bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground">
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <PageHeader title="Profile" subtitle={user.email ?? "NOVA account"} />

      <section className="space-y-3">
        <SectionHeader title="Account details" />
        {[
          { label: "Username", value: username, set: setUsername },
          { label: "Display name", value: displayName, set: setDisplayName },
          { label: "Avatar URL", value: avatarUrl, set: setAvatarUrl },
        ].map((f) => (
          <div key={f.label}>
            <label className="nova-label mb-1 block">{f.label}</label>
            <input
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              className="h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-border-strong"
            />
          </div>
        ))}
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="h-11 w-full rounded-sm bg-primary text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-60"
        >
          Save profile
        </button>
      </section>

      <section>
        <SectionHeader title="Discord" />
        <div className="nova-panel space-y-1 px-3 py-3 text-sm">
          <p className="text-muted-foreground">
            Discord username: {profile?.discord_username ?? "Not connected"}
          </p>
          <p className="text-muted-foreground">Discord ID: {profile?.discord_id ?? "—"}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Discord details are populated automatically when you sign in with Discord. Discord OAuth
            must first be configured in the backend auth settings with a Discord client ID and
            client secret.
          </p>
        </div>
      </section>

      <section>
        <SectionHeader title="Roles" />
        <div className="nova-panel px-3 py-3 text-sm text-muted-foreground">
          {roles.length ? roles.join(", ") : "user"}
        </div>
      </section>

      <button
        onClick={() => void signOut()}
        className="h-11 w-full rounded-sm border border-border text-sm font-bold uppercase tracking-wider text-muted-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
