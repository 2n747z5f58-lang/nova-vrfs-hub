import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  Home,
  LayoutDashboard,
  ListOrdered,
  Menu,
  Shield,
  Star,
  Trophy,
  User,
  Users,
  UserRound,
  X,
  ClipboardList,
} from "lucide-react";
import novaMark from "@/assets/nova-mark.asset.json";
import { useAuth } from "@/hooks/useAuth";
import { listNotifications } from "@/lib/nova/api";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/matches", label: "Matches", icon: CalendarDays },
  { to: "/leagues", label: "Leagues", icon: Trophy },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/players", label: "Players", icon: UserRound },
  { to: "/standings", label: "Standings", icon: ListOrdered },
  { to: "/results", label: "Results", icon: ClipboardList },
  { to: "/favourites", label: "Favourites", icon: Star },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const MOBILE_TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/matches", label: "Matches", icon: CalendarDays },
  { to: "/leagues", label: "Leagues", icon: Trophy },
  { to: "/favourites", label: "Faves", icon: Star },
  { to: "/notifications", label: "Alerts", icon: Bell },
] as const;

export function NovaLogo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <img
        src={novaMark.url}
        alt="NOVA"
        className="h-8 w-8 rounded-sm border border-border object-cover"
      />
      <span className="text-lg font-black tracking-[0.22em]">NOVA</span>
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isStaff, signOut } = useAuth();
  const unread = useUnreadCount();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = isStaff ? [...NAV, { to: "/admin", label: "Admin", icon: Shield } as const] : NAV;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border text-foreground lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <NovaLogo />
          <nav className="ml-6 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "shrink-0 rounded-sm px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-surface hover:text-foreground",
                  pathname === item.to && "bg-surface text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              to="/notifications"
              className="relative grid h-9 w-9 place-items-center rounded-sm border border-border"
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
              <button
                onClick={() => void signOut()}
                className="hidden h-9 items-center rounded-sm border border-border px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground sm:flex"
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex h-9 items-center rounded-sm bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground"
              >
                Sign in
              </Link>
            )}
          </div>
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
                    "flex items-center gap-2 bg-background px-4 py-3 text-sm font-medium text-muted-foreground",
                    pathname === item.to && "text-foreground",
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

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 lg:pb-12">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map((tab) => {
            const active = pathname === tab.to;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
                {tab.to === "/notifications" && unread > 0 && (
                  <span className="absolute right-4 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                )}
                {active && <span className="absolute top-0 h-0.5 w-8 bg-foreground" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
