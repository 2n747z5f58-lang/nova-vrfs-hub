import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const navigation = [
  { label: "Home", to: "/", icon: "⌂" },
  { label: "Matches", to: "/fixtures", icon: "⚽" },
  { label: "Results", to: "/results", icon: "▣" },
  { label: "Leagues", to: "/leagues", icon: "🏆" },
  { label: "Teams", to: "/teams", icon: "♟" },
  { label: "Players", to: "/players", icon: "◎" },
  { label: "Transfers", to: "/transfers", icon: "↔" },
];

const secondaryNavigation = [
  { label: "Favourites", to: "/favourites", icon: "★" },
  { label: "Notifications", to: "/notifications", icon: "♧" },
  { label: "Profile", to: "/profile", icon: "●" },
  { label: "Admin", to: "/admin", icon: "⚙" },
];

export const Route = createFileRoute("/_authenticated")({
  ssr: false,

  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },

  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const location = useLocation();

  const isActive = (to: string) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/10 bg-[#0b0b0b] lg:flex lg:flex-col">
        {/* Logo */}
        <div className="flex h-20 items-center border-b border-white/10 px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black font-black text-lg">
              N
            </div>

            <div>
              <div className="text-xl font-black tracking-tight">NOVA</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                VRFS Football
              </div>
            </div>
          </Link>
        </div>

        {/* Main navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-6">
          <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
            Explore
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  isActive(item.to)
                    ? "bg-white text-black"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex w-6 justify-center text-base">
                  {item.icon}
                </span>

                {item.label}
              </Link>
            ))}
          </nav>

          <p className="px-3 pb-3 pt-8 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
            Personal
          </p>

          <nav className="space-y-1">
            {secondaryNavigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  isActive(item.to)
                    ? "bg-white text-black"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex w-6 justify-center text-base">
                  {item.icon}
                </span>

                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/[0.04] p-4">
            <p className="text-xs font-semibold text-white/70">
              NOVA
            </p>

            <p className="mt-1 text-[11px] text-white/30">
              VRFS Esports Football
            </p>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#070707]/90 px-4 backdrop-blur-xl sm:px-6">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-black text-black">
              N
            </div>

            <span className="font-black tracking-tight">NOVA</span>
          </Link>

          {/* Desktop title */}
          <div className="hidden lg:block">
            <p className="text-xs font-medium text-white/30">
              NOVA / VRFS
            </p>

            <p className="text-sm font-bold">
              {navigation.find((item) => isActive(item.to))?.label ??
                secondaryNavigation.find((item) => isActive(item.to))?.label ??
                "Dashboard"}
            </p>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              ♧
            </Link>

            <Link
              to="/profile"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-black transition hover:bg-white/90"
            >
              U
            </Link>
          </div>
        </header>

        {/* Page */}
        <main className="min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0b0b0b]/95 px-2 py-2 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {[
            navigation[0],
            navigation[1],
            navigation[3],
            navigation[5],
            secondaryNavigation[2],
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition ${
                isActive(item.to)
                  ? "bg-white text-black"
                  : "text-white/50"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
