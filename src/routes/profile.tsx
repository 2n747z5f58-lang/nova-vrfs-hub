import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  Image as ImageIcon,
  Save,
  User,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SoundSettings } from "@/components/nova/SoundSettings";

export const Route = createFileRoute("/profile")({
  ssr: false,
  component: Profile,
});

type ProfileData = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
};

function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const [memberNumber, setMemberNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You are not signed in.");
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, bio, avatar_url, banner_url",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError("Your profile could not be found.");
        setLoading(false);
        return;
      }

      const currentProfile = data as ProfileData;

      setProfile(currentProfile);
      setUsername(currentProfile.username ?? "");
      setDisplayName(currentProfile.display_name ?? "");
      setBio(currentProfile.bio ?? "");
      setAvatarUrl(currentProfile.avatar_url ?? "");
      setBannerUrl(currentProfile.banner_url ?? "");

      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: false })
        .lte("created_at", new Date().toISOString());

      if (count !== null) {
        const { data: members } = await supabase
          .from("profiles")
          .select("id, created_at")
          .order("created_at", { ascending: true });

        if (members) {
          const position = members.findIndex(
            (member) => member.id === user.id,
          );

          if (position !== -1) {
            setMemberNumber(position + 1);
          }
        }
      }

      setLoading(false);
    }

    void loadProfile();
  }, []);

  async function saveProfile() {
    setError("");
    setSaved(false);

    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();
    const cleanBio = bio.trim();

    if (!cleanUsername || !cleanDisplayName) {
      setError("Username and display name are required.");
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setError(
        "Username must be 3–20 characters and only use letters, numbers, or underscores.",
      );
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You are not signed in.");
      setSaving(false);
      return;
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .neq("id", user.id)
      .maybeSingle();

    if (existingProfile) {
      setError("That username is already taken.");
      setSaving(false);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        display_name: cleanDisplayName,
        bio: cleanBio || null,
        avatar_url: avatarUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
      })
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setProfile(data as ProfileData);
    setUsername(cleanUsername);
    setDisplayName(cleanDisplayName);
    setBio(cleanBio);
    setAvatarUrl(avatarUrl.trim());
    setBannerUrl(bannerUrl.trim());

    setSaved(true);
    setSaving(false);

    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-[1000px] items-center justify-center px-5">
          <p className="text-sm text-muted-foreground">
            Loading your profile...
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-[1000px] items-center justify-center px-5">
          <div className="text-center">
            <User className="mx-auto mb-4 size-8 text-muted-foreground" />
            <h1 className="text-xl font-semibold">
              Profile unavailable
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {error || "We couldn't load your profile."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1000px] px-5 py-8 lg:px-10">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to overview
        </Link>

        <div className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Account settings
          </p>

          <h1 className="text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            Your profile
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Manage how you appear across NOVA.
          </p>
        </div>

        <section className="overflow-hidden border border-border bg-card">
          <div
            className="relative h-48 bg-muted"
            style={
              bannerUrl
                ? {
                    backgroundImage: `url("${bannerUrl}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {!bannerUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="size-8 text-muted-foreground/40" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            <div className="absolute bottom-5 left-5">
              <div className="grid size-24 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-background shadow-xl">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || username}
                    className="size-full object-cover"
                  />
                ) : (
                  <User className="size-9 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>

          <div className="p-6 pt-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {displayName || "Your Name"}
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  @{username}
                </p>
              </div>

              {memberNumber && (
                <span className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  Member #{memberNumber}
                </span>
              )}
            </div>

            {bio && (
              <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
                {bio}
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Profile information</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update the information other NOVA members will see.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="display-name"
                className="mb-2 block text-sm font-medium"
              >
                Display name
              </label>

              <input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={40}
                className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm outline-none transition-colors focus:border-foreground"
              />
            </div>

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
                onChange={(event) => setUsername(event.target.value)}
                maxLength={20}
                className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm outline-none transition-colors focus:border-foreground"
              />

              <p className="mt-2 text-xs text-muted-foreground">
                3–20 characters. Letters, numbers and underscores.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="bio"
              className="mb-2 block text-sm font-medium"
            >
              Bio
            </label>

            <textarea
              id="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={300}
              rows={4}
              placeholder="Tell people a little about yourself..."
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors focus:border-foreground"
            />

            <p className="mt-2 text-xs text-muted-foreground">
              {bio.length}/300
            </p>
          </div>

          <div className="mt-5">
            <label
              htmlFor="avatar-url"
              className="mb-2 block text-sm font-medium"
            >
              Profile picture URL
            </label>

            <div className="relative">
              <Camera className="absolute left-3 top-3.5 size-4 text-muted-foreground" />

              <input
                id="avatar-url"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://..."
                className="h-12 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm outline-none transition-colors focus:border-foreground"
              />
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Image uploading will be connected to NOVA storage next.
            </p>
          </div>

          <div className="mt-5">
            <label
              htmlFor="banner-url"
              className="mb-2 block text-sm font-medium"
            >
              Profile banner URL
            </label>

            <div className="relative">
              <ImageIcon className="absolute left-3 top-3.5 size-4 text-muted-foreground" />

              <input
                id="banner-url"
                value={bannerUrl}
                onChange={(event) => setBannerUrl(event.target.value)}
                placeholder="https://..."
                className="h-12 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm outline-none transition-colors focus:border-foreground"
              />
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Image uploading will be connected to NOVA storage next.
            </p>
          </div>

          {error && (
            <p className="mt-5 text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-4">
            {saved ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="size-4" />
                Profile saved
              </p>
            ) : (
              <span />
            )}

            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={saving}
              className="flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 disabled:translate-y-0 disabled:opacity-60"
            >
              <Save className="size-4" />
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </section>

        <div className="mt-6">
          <SoundSettings />
        </div>
      </div>
    </main>
  );
}
