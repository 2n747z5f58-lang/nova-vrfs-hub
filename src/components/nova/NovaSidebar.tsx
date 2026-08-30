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
type SearchResult = {
  type: "player" | "team" | "league" | "profile";
  id: string;
  name: string;
  subtitle?: string;
  avatar_url?: string | null;
  route: string;
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
  );
}
export function NovaHeader({
  onMenu,
}: {
  onMenu: () => void;
}) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
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
    if (!query) {
      setResults([]);
      setSearchOpen(false);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchOpen(true);
      const pattern = `%${query}%`;
      const [profilesResponse, playersResponse, teamsResponse, leaguesResponse] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url")
            .or(`display_name.ilike.${pattern},username.ilike.${pattern}`)
            .limit(5),
          supabase
            .from("players")
            .select("id, name, username, avatar_url")
            .or(`name.ilike.${pattern},username.ilike.${pattern}`)
            .limit(5),
          supabase
            .from("teams")
            .select("id, name, logo_url")
            .ilike("name", pattern)
            .limit(5),
          supabase
            .from("leagues")
            .select("id, name, logo_url")
            .ilike("name", pattern)
            .limit(5),
        ]);
      if (cancelled) return;
      const nextResults: SearchResult[] = [];
      if (!profilesResponse.error && profilesResponse.data) {
        for (const profile of profilesResponse.data) {
          nextResults.push({
            type: "profile",
            id: profile.id,
            name:
              profile.display_name ||
              profile.username ||
              "Unnamed user",
            subtitle: profile.username
              ? `@${profile.username}`
              : "Profile",
            avatar_url: profile.avatar_url,
            route: `/profile/${profile.username || profile.id}`,
          });
        }
      }
      if (!playersResponse.error && playersResponse.data) {
        for (const player of playersResponse.data) {
          nextResults.push({
            type: "player",
            id: player.id,
            name: player.name || player.username || "Unnamed player",
            subtitle: "Player",
            avatar_url: player.avatar_url,
            route: `/players/${player.id}`,
          });
        }
      }
      if (!teamsResponse.error && teamsResponse.data) {
        for (const team of teamsResponse.data) {
          nextResults.push({
            type: "team",
            id: team.id,
            name: team.name,
            subtitle: "Team",
            avatar_url: team.logo_url,
            route: `/teams/${team.id}`,
          });
        }
      }
      if (!leaguesResponse.error && leaguesResponse.data) {
        for (const league of leaguesResponse.data) {
          nextResults.push({
            type: "league",
            id: league.id,
            name: league.name,
            subtitle: "League",
            avatar_url: league.logo_url,
            route: `/leagues/${league.id}`,
          });
        }
      }
      setResults(nextResults.slice(0, 12));
      setSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);
  const goToSearchResult = (result: SearchResult) => {
    playUiSound();
    setSearch("");
    setResults([]);
    setSearchOpen(false);
    void navigate({ to: result.route as any });
  };
  const submitSearch = () => {
    if (!search.trim()) return;
    if (results.length > 0) {
      goToSearchResult(results[0]);
      return;
    }
    void navigate({
      to: "/search" as any,
      search: { q: search.trim() } as any,
    });
    setSearchOpen(false);
  };
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
  const renderSearchBox = () => (
    <div className="relative w-full">
      <Search className="absolute left-3 top-2.5 z-10 size-4 text-muted-foreground" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => {
          if (search.trim()) {
            setSearchOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submitSearch();
          }
          if (e.key === "Escape") {
            setSearchOpen(false);
          }
        }}
        aria-label="Search teams, players, leagues or profiles"
        aria-expanded={searchOpen}
        placeholder="Search teams, players, leagues..."
        autoComplete="off"
        className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
      />
      {searchOpen && search.trim() && (
        <div className="absolute left-0 right-0 top-12 z-[100] overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
          {searching ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="py-1">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToSearchResult(result)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
                >
                  <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-sidebar">
                    {result.avatar_url ? (
                      <img
                        src={result.avatar_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">
                        {result.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {result.name}
                    </div>
                    <div className="text-xs capitalize text-muted-foreground">
                      {result.subtitle || result.type}
                    </div>
                  </div>
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={submitSearch}
                className="w-full border-t border-border px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                Press Enter to view all results for "{search.trim()}"
              </button>
            </div>
          ) : (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={submitSearch}
              className="w-full px-4 py-3 text-left text-sm text-muted-foreground hover:bg-white/10"
            >
              No results found. Press Enter to search for "{search.trim()}".
            </button>
          )}
        </div>
      )}
    </div>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-sidebar/95 px-4 backdrop-blur sm:px-5 lg:px-8">
      <div className="flex h-16 items-center gap-3">
        <button
          aria-label="Open navigation"
          onClick={onMenu}
          className="rounded-md p-2 lg:hidden"
        >
          <LayoutGrid className="size-5" />
        </button>
        <div className="relative hidden w-full max-w-md lg:block">
          {renderSearchBox()}
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
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
      </div>
      <div className="pb-3 lg:hidden">
        {renderSearchBox()}
      </div>
    </header>
  );
}
