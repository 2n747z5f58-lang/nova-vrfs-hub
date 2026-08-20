import { useState, useEffect, useRef } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarDays, Hop as Home, LayoutDashboard, ListOrdered, Menu, Shield, Star, Trophy, User, Users, UserRound, X, ClipboardList, ArrowLeftRight, Search } from "lucide-react";
import novaMark from "@/assets/nova-mark.asset.json";
import { useAuth } from "@/hooks/useAuth";
import { listNotifications, globalSearch, type SearchResult } from "@/lib/nova/api";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/matches", label: "Fixtures", icon: CalendarDays },
  { to: "/leagues", label: "Leagues", icon: Trophy },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/players", label: "Players", icon: UserRound },
  { to: "/standings", label: "Standings", icon: ListOrdered },
  { to: "/results", label: "Results", icon: ClipboardList },
  { to: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { to: "/favourites", label: "Favourites", icon: Star },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const MOBILE_TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/matches", label: "Fixtures", icon: CalendarDays },
  { to: "/leagues", label: "Leagues", icon: Trophy },
  { to: "/favourites", label: "Faves", icon: Star },
  { to: "/notifications", label: "Alerts", icon: Bell },
] as const;

export function NovaLogo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)}>
      <img
        src={novaMark.url}
        alt="NOVA"
        className="h-7 w-7 rounded-md border border-sidebar-border object-cover"
      />
      <span className="text-base font-black tracking-[0.2em] text-sidebar-foreground">NOVA</span>
    </Link>
  );
}

function useUnreadCount() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => listNotifications(user!.id),
    enabled: !!user,
  });
  return (data ?? []).filter((n) => !n.read).length;
}

function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await globalSearch(query);
        setResults(r);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative hidden flex-1 max-w-xs lg:block">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search teams, players, leagues…"
          className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-muted-focus focus:border-accent-green focus:outline-none transition-colors"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl slide-up">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => {
                navigate({ to: r.href });
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-0 transition-colors hover:bg-surface-2"
            >
              <span className="nova-label min-w-[52px] text-accent-green">{r.type}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{r.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isStaff, signOut } = useAuth();
  const unread = useUnreadCount();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = isStaff
    ? [...NAV, { to: "/admin", label: "Admin", icon: Shield } as const]
    : NAV;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-56 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <NovaLogo />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {items.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", active && "text-accent-green")} />
                {item.label}
                {item.to === "/notifications" && unread > 0 && (
                  <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          {user ? (
            <button
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/auth"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-accent-green px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent-green-foreground transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-foreground"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <NovaLogo />
          <Link
            to="/notifications"
            className="relative ml-auto grid h-9 w-9 place-items-center rounded-md border border-border"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </div>
        {menuOpen && (
          <nav className="border-t border-border bg-surface lg:hidden">
            <div className="grid grid-cols-2 gap-px p-px">
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 bg-background px-4 py-3 text-sm font-medium transition-colors",
                    pathname === item.to ? "text-accent-green" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
            {user && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
                className="w-full border-t border-border px-4 py-3 text-left text-sm text-muted-foreground"
              >
                Sign out
              </button>
            )}
          </nav>
        )}
      </header>

      {/* Desktop top bar */}
      <header className="sticky top-0 z-20 hidden h-14 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur lg:flex lg:ml-56">
        <SearchBar />
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/notifications"
            className="relative grid h-9 w-9 place-items-center rounded-md border border-border transition-colors hover:border-border-strong"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          {user ? (
            <Link
              to="/profile"
              className="flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Profile
            </Link>
          ) : (
            <Link
              to="/auth"
              className="flex h-9 items-center rounded-md bg-accent-green px-3 text-xs font-bold uppercase tracking-wider text-accent-green-foreground transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 lg:ml-56 lg:px-8 lg:pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map((tab) => {
            const active = pathname === tab.to;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  active ? "text-accent-green" : "text-muted-foreground",
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
                {tab.to === "/notifications" && unread > 0 && (
                  <span className="absolute right-4 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                )}
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent-green" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
