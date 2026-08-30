import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowUpRight, CalendarDays, ChevronRight, Clock3, ShieldCheck, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NovaHeader, NovaSidebar } from "../components/nova/NovaSidebar";
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" as any });
  },
  head: () => ({
    meta: [
      { title: "NOVA — VRFS" },
      {
        name: "description",
        content:
          "NOVA is the professional statistics and league-management platform for VRFS.",
      },
    ],
  }),
  component: Index,
});
const sections = [
  {
    title: "Today's fixtures",
    icon: CalendarDays,
    empty: "No fixtures scheduled for today",
  },
  {
    title: "Upcoming fixtures",
    icon: Clock3,
    empty: "No upcoming fixtures",
  },
  {
    title: "Recent results",
    icon: Trophy,
    empty: "No results available",
  },
];
function EmptyPanel({
  title,
  empty,
  Icon,
}: {
  title: string;
  empty: string;
  Icon: typeof CalendarDays;
}) {
  return (
    <section className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <Icon className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        </div>
        <Link
          to={"/fixtures" as any}
          className="text-xs text-muted-foreground hover:text-primary"
        >
          View all{" "}
          <ChevronRight className="ml-1 inline size-3" />
        </Link>
      </div>
      <div className="flex min-h-36 flex-col items-center justify-center px-5 text-center">
        <span className="mb-3 grid size-10 place-items-center border border-dashed border-border text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <p className="text-sm text-muted-foreground">{empty}</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Connect your league data to see updates here.
        </p>
      </div>
    </section>
  );
}
function Index() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft(getTimeLeft());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <NovaSidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <div className="min-w-0 flex-1">
          <NovaHeader onMenu={() => setMobileOpen(true)} />
          <main
            id="main"
            className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8"
          >
            <section className="relative mb-8 min-h-[420px] overflow-hidden border border-border bg-black text-white md:min-h-[520px]">
              <img
                src="https://kommodo.ai/i/74IxDV9sEJDq6MYtc87C"
                alt="Hannover 96 vs Queen Edith FC"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/45" />
              <div className="relative flex min-h-[420px] flex-col justify-end p-6 md:min-h-[520px] md:p-10">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-white/75">
                  Match Centre
                </p>
                <h1 className="max-w-4xl text-4xl font-black uppercase leading-none tracking-[-0.05em] md:text-6xl">
                  Hannover 96 vs Queen Edith FC
                </h1>
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-white/80">
                  VNO FA CUP FINAL
                </p>
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-white/70">
                  4:30 PM K.O. · LIVE ON NOVA TV
                </p>
                <div className="mt-6 text-2xl font-black uppercase tracking-tight md:text-4xl">
                  Countdown: {formatTimeLeft(timeLeft)}
                </div>
              </div>
            </section>
            <div className="mb-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                VRFS / Match Centre
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Match Centre
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Your live view of leagues, fixtures and the people shaping the
                VRFS season.
              </p>
            </div>
            <div className="mb-8 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
              <Stat icon={Trophy} label="Active leagues" />
              <Stat icon={CalendarDays} label="Fixtures tracked" />
              <Stat icon={Users} label="Registered teams" />
              <Stat icon={ShieldCheck} label="Players indexed" />
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              {sections.map(({ title, icon, empty }) => (
                <EmptyPanel
                  key={title}
                  title={title}
                  Icon={icon}
                  empty={empty}
                />
              ))}
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <EmptyPanel
                title="Featured leagues"
                Icon={Trophy}
                empty="No leagues created yet"
              />
              <EmptyPanel
                title="Recent transfers"
                Icon={Users}
                empty="No transfers yet"
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
function getTimeLeft() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(16, 30, 0, 0);
  return Math.max(0, target.getTime() - now.getTime());
}
function formatTimeLeft(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}
function Stat({
  icon: Icon,
  label,
}: {
  icon: typeof Trophy;
  label: string;
}) {
  return (
    <div className="bg-card px-4 py-5">
      <Icon className="mb-3 size-4 text-muted-foreground" />
      <p className="text-2xl font-bold">—</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
