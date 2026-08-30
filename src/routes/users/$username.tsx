import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Shield, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/users/$username")({
  ssr: false,
  component: PublicProfile,
});

type ProfileData = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  created_at: string;
};

function PublicProfile() {
  const { username } = Route.useParams();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [memberNumber, setMemberNumber] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError("");

      const cleanUsername = username.trim().toLowerCase();

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, bio, avatar_url, banner_url, created_at",
        )
        .eq("username", cleanUsername)
        .maybeSingle();

      if (profileError) {
        setError("Could not load this profile.");
        setLoading(false);
        return;
      }

      if (!data) {
        setError("This profile doesn't exist.");
        setLoading(false);
        return;
      }

      const currentProfile = data as ProfileData;
      setProfile(currentProfile);

      const { data: members } = await supabase
        .from("profiles")
        .select("id, created_at")
        .order("created_at", { ascending: true });

      if (members) {
        const position = members.findIndex(
          (member) => member.id === currentProfile.id,
        );

        if (position !== -1) {
          setMemberNumber(position + 1);
        }
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentProfile.id)
        .maybeSingle();

      if (roleData?.role) {
        setRole(String(roleData.role));
      }

      setLoading(false);
    }

    void loadProfile();
  }, [username]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Loading profile...
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-[700px] items-center justify-center px-5">
          <div className="text-center">
            <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-border bg-card">
              <User className="size-6 text-muted-foreground" />
            </div>

            <h1 className="text-2xl font-bold">
              Profile not found
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {error || "This NOVA member doesn't exist."}
            </p>

            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-white/5"
            >
              <ArrowLeft className="size-4" />
              Back to NOVA
            </Link>
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
          className="mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to NOVA
        </Link>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div
            className="relative h-56 bg-muted md:h-64"
            style={
              profile.banner_url
                ? {
                    backgroundImage: `url("${profile.banner_url}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {!profile.banner_url && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
                  NOVA
                </div>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

            <div className="absolute bottom-[-42px] left-6">
              <div className="grid size-28 place-items-center overflow-hidden rounded-full border-4 border-card bg-background shadow-2xl">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name || profile.username || "User"}
                    className="size-full object-cover"
                  />
                ) : (
                  <User className="size-10 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>

          <div className="px-6 pb-7 pt-14">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {profile.display_name || profile.username}
                  </h1>

                  {role && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Shield className="size-3" />
                      {role}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  @{profile.username}
                </p>
              </div>

              {memberNumber && (
                <div className="rounded-lg border border-border bg-background px-4 py-2.5 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    NOVA member
                  </p>

                  <p className="mt-0.5 text-lg font-bold">
                    #{memberNumber}
                  </p>
                </div>
              )}
            </div>

            {profile.bio ? (
              <p className="mt-7 max-w-2xl text-sm leading-7 text-muted-foreground">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-7 text-sm italic text-muted-foreground/60">
                This member hasn't added a bio yet.
              </p>
            )}
          </div>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Teams
            </p>

            <h2 className="mt-2 text-lg font-semibold">
              No teams yet
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Teams this member plays for or manages will appear here.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Leagues
            </p>

            <h2 className="mt-2 text-lg font-semibold">
              No leagues yet
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Leagues this member is involved with will appear here.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
