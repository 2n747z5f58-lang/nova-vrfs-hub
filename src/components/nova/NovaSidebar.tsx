import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Heart,
  Home,
  LayoutGrid,
  LogIn,
  Medal,
  Radio,
  Search,
  Shield,
  Swords,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playUiSound } from "@/lib/sounds";

const links = [
  ["Home", "/", Home],
  ["Leagues", "/leagues", Trophy],
  ["Fixtures", "/fixtures", Radio],
  ["Results", "/results", Medal],
  ["Teams", "/teams", Shield],
  ["Players", "/players", Users],
  ["Transfers", "/transfers", Swords],
  ["Favourites", "/favourites", Heart],
  ["Notifications", "/notifications", Bell],
] as const;

type HeaderProfile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export function NovaSidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;

      setRole(
        (data.user?.app_metadata?.role ??
          data.user?.user_metadata?.role) as string | null,
      );
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-border px-6">
          <Link
            to="/"
            onClick={() => playUiSound()}
            className="flex items-center gap-3 text-foreground"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <LayoutGrid className="size-4" />
            </span>

            <span className="font-black tracking-[0.24em]">
              NOVA
            </span>
          </Link>

          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-2 lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {links.map(([label, to, Icon]) => (
            <Link
              key={label}
              to={to as any}
              onClick={() => {
                onClose?.();
                playUiSound();
              }}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                location.pathname === to
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}

          {role === "admin" && (
            <Link
              to={"/admin" as any}
              onClick={() => {
                onClose?.();
                playUiSound();
              }}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                location.pathname === "/admin"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
            >
              <Shield className="size-4" />
              Admin
            </Link>
          )}

          <div className="my-4 border-t border-border" />

          <Link
            to={"/profile" as any}
            onClick={() => {
              onClose?.();
              playUiSound();
            }}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              location.pathname === "/profile"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
            }`}
          >
            <User className="size-4" />
            Profile
          </Link>
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={async () => {
              playUiSound();
              await supabase.auth.signOut();
              void navigate({ to: "/auth" as any });
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-all duration-200 hover:bg-white/10 hover:text-foreground"
          >
            <LogIn className="size-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  }

export function NovaHeader({
  onMenu,
}: {
  onMenu: () => void;
}) {
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<HeaderProfile[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) return;

      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (mounted && data) {
        setProfile(data as HeaderProfile);
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const query = search.trim();

    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;

    async function searchProfiles() {
      setSearching(true);

      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .or(
          `username.ilike.%${query}%,display_name.ilike.%${query}%`,
        )
        .limit(6);

      if (!cancelled) {
        setResults((data ?? []) as HeaderProfile[]);
        setSearching(false);
      }
    }

    const timeout = window.setTimeout(() => {
      void searchProfiles();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [search]);

  const nameForInitials =
    profile?.display_name?.trim() ||
    profile?.username?.trim() ||
    "NOVA";

  const initials = nameForInitials
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-sidebar/95 px-5 backdrop-blur lg:px-8">
      <button
        aria-label="Open navigation"
        onClick={onMenu}
        className="rounded-md p-2 lg:hidden"
      >
        <LayoutGrid className="size-5" />
      </button>

      <div className="relative hidden w-full max-w-md lg:block">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search teams, players, leagues or matches"
          placeholder="Search teams, players, leagues..."
          className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
        />

        {search.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-12 overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            {searching ? (
              <div className="px-4 py-4 text-sm text-muted-foreground">
                Searching...
              </div>
            ) : results.length > 0 ? (
              <div className="py-1">
                {results.map((result) => {
                  const resultName =
                    result.display_name ||
                    result.username ||
                    "NOVA User";

                  const resultInitials = resultName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part.charAt(0))
                    .join("")
                    .toUpperCase();

                  return (
                    <Link
                      key={result.username}
                      to={`/users/${result.username}` as any}
                      onClick={() => {
                        playUiSound();
                        setSearch("");
                        setResults([]);
                      }}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                    >
                      <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-background text-xs font-bold">
                        {result.avatar_url ? (
                          <img
                            src={result.avatar_url}
                            alt={resultName}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span>{resultInitials}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {resultName}
                        </p>

                        <p className="truncate text-xs text-muted-foreground">
                          @{result.username}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-4 text-sm text-muted-foreground">
                No users found.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <button
          aria-label="Notifications"
          className="rounded-md p-2 text-muted-foreground transition-all duration-200 hover:bg-white/10 hover:text-foreground"
        >
          <Bell className="size-5" />
        </button>

        <Link
          to={"/profile" as any}
          aria-label="Open profile"
          className="grid size-9 place-items-center overflow-hidden rounded-full border border-border bg-card text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground"
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={
                profile.display_name ||
                profile.username ||
                "Profile"
              }
              className="size-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </Link>
      </div>
    </header>
  );
}
}

