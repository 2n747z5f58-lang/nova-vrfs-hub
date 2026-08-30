import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Check,
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
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playUiSound } from "@/lib/sounds";

type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  viewed: boolean;
  created_at: string;
};

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
      if (mounted) {
        setRole(
          (data.user?.app_metadata?.role ??
            data.user?.user_metadata?.role) as string | null,
        );
      }
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
            className="flex items-center gap-3 text-foreground"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <LayoutGrid className="size-4" />
            </span>

            <span className="font-black tracking-[0.24em]">NOVA</span>
          </Link>

          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-2 lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {links.map(([label, to, Icon]) => (
            <Link
              key={label}
              to={to as any}
              onClick={() => {
                onClose?.();
                playUiSound();
              }}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${
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
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${
                location.pathname === "/admin"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
            >
              <Shield className="size-4" />
              Admin
            </Link>
          )}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={async () => {
              playUiSound();
              await supabase.auth.signOut();
              void navigate({ to: "/auth" as any });
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            <LogIn className="size-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

export function NovaHeader({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const unreadCount = notifications.filter(
    (notification) => !notification.viewed,
  ).length;

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadNotifications() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) return;

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (mounted && data) {
        setNotifications(data as Notification[]);
      }

      channel = supabase
        .channel(`nova-header-notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((current) => [
              payload.new as Notification,
              ...current,
            ].slice(0, 5));
          },
        )
        .subscribe();
    }

    void loadNotifications();

    return () => {
      mounted = false;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  async function markAsViewed(notification: Notification) {
    if (notification.viewed) return;

    await supabase
      .from("notifications")
      .update({ viewed: true })
      .eq("id", notification.id);

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, viewed: true }
          : item,
      ),
    );
  }

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
          aria-label="Search teams, players, leagues or matches"
          placeholder="Search teams, players, leagues..."
          className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
        />
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="relative">
          <button
            aria-label="Notifications"
            onClick={() => {
              playUiSound();
              setDropdownOpen((open) => !open);
            }}
            className="relative rounded-md p-2 text-muted-foreground transition-all duration-200 hover:bg-white/10 hover:text-foreground"
          >
            <Bell className="size-5" />

            {unreadCount > 0 && (
              <span className="absolute right-0.5 top-0.5 grid min-w-4 translate-x-1/4 -translate-y-1/4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {dropdownOpen && (
            <>
              <button
                aria-label="Close notifications"
                onClick={() => setDropdownOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />

              <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Notifications</p>
                    {unreadCount > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {unreadCount} unread
                      </p>
                    )}
                  </div>

                  <Bell className="size-4 text-muted-foreground" />
                </div>

                {notifications.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <Bell className="mx-auto mb-3 size-5 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      No notifications
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You're all caught up.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => {
                          void markAsViewed(notification);
                        }}
                        className={`flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent ${
                          notification.viewed
                            ? ""
                            : "bg-primary/5"
                        }`}
                      >
                        <div
                          className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
                            notification.viewed
                              ? "border border-border text-muted-foreground"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          {notification.viewed ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Bell className="size-3.5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold">
                              {notification.title}
                            </p>

                            {!notification.viewed && (
                              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>

                          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {notification.message}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    void navigate({ to: "/notifications" as any });
                  }}
                  className="w-full border-t border-border px-4 py-3 text-center text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  View all notifications
                </button>
              </div>
            </>
          )}
        </div>

        <span className="grid size-9 place-items-center rounded-lg border border-border bg-card text-xs font-bold">
          N
        </span>
      </div>
    </header>
  );
}
