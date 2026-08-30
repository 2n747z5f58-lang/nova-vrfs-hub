import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NovaHeader, NovaSidebar } from "../components/nova/NovaSidebar";
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" as any });
    }
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
            className="mx-auto max-w-[1500px] px-5 pb-16 pt-6 lg:px-10"
          >
            {/* FEATURED MATCH */}
            <section className="relative -mx-5 mb-12 overflow-hidden sm:-mx-8 lg:-mx-10">
              {/* Graphic */}
              <div className="relative w-full">
                <img
                  src="https://user28025.na.imgto.link/public/20260830/c3b8018b-ffcd-4a79-b3ca-584b1f5c52da.avif"
                  alt="Hannover 96 vs Queen Edith FC"
                  className="block h-auto w-full object-contain"
                />
                {/* Bottom fade ONLY */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-background via-background/70 to-transparent" />
              </div>
              {/* Match information */}
              <div className="relative -mt-20 px-5 sm:-mt-28 sm:px-8 lg:-mt-36 lg:px-10">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
                  Match Centre
                </p>
                <div className="flex items-center gap-4">
                  <img
                    src="https://imagepaste.org/i/uq8vd2hb.png"
                    alt="Hannover 96"
                    className="size-12 object-contain sm:size-16"
                  />
                  <h1 className="text-3xl font-black uppercase tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                    Hannover 96
                  </h1>
                  <span className="text-sm font-bold text-muted-foreground sm:text-lg">
                    VS
                  </span>
                  <span className="text-3xl font-black uppercase tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                    QE
                  </span>
                </div>
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em]">
                  VNO FA CUP FINAL
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  4:30 PM K.O. · LIVE ON NOVA TV
                </p>
                <div className="mt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                    Kickoff countdown
                  </p>
                  <p className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                    {formatTimeLeft(timeLeft)}
                  </p>
                </div>
              </div>
            </section>
            {/* MATCH CENTRE */}
            <section className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                VRFS / Match Centre
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Match Centre
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Fixtures, results and live action from across the VRFS
                competitive scene.
              </p>
            </section>
            {/* QUICK STATS */}
            <section className="mb-5 grid grid-cols-2 border-y border-border md:grid-cols-4">
              <Stat icon={Trophy} label="Active leagues" />
              <Stat icon={CalendarDays} label="Fixtures tracked" />
              <Stat icon={Users} label="Registered teams" />
              <Stat icon={ShieldCheck} label="Players indexed" />
            </section>
            {/* FIXTURE SECTIONS */}
            <div className="divide-y divide-border">
              {sections.map(({ title, icon, empty }) => (
                <FixtureSection
                  key={title}
                  title={title}
                  Icon={icon}
                  empty={empty}
                />
              ))}
            </div>
            {/* LOWER SECTIONS */}
            <div className="mt-4 grid divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <SimpleSection
                title="Featured leagues"
                Icon={Trophy}
                empty="No leagues created yet"
              />
              <SimpleSection
                title="Recent transfers"
                Icon={Users}
                empty="No transfers yet"
                className="lg:pl-10"
              />
            </div>
            <div className="mt-8 flex justify-end">
              <Link
                to={"/leagues" as any}
                className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                Explore leagues
                <ChevronRight className="ml-1 inline size-4" />
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
function FixtureSection({
  title,
  Icon,
  empty,
}: {
  title: string;
  Icon: typeof CalendarDays;
  empty: string;
}) {
  return (
    <section className="py-7">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <Link
          to={"/fixtures" as any}
          className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          View all
          <ChevronRight className="ml-1 inline size-3" />
        </Link>
      </div>
      <div className="min-h-28 border-t border-border py-9">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{empty}</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Connect your league data to see updates here.
          </p>
        </div>
      </div>
    </section>
  );
}
function SimpleSection({
  title,
  Icon,
  empty,
  className = "",
}: {
  title: string;
  Icon: typeof Trophy;
  empty: string;
  className?: string;
}) {
  return (
    <section className={`py-7 ${className}`}>
      <div className="mb-5 flex items-center gap-3">
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="border-t border-border py-9">
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    </section>
  );
}
function Stat({
  icon: Icon,
  label,
}: {
  icon: typeof Trophy;
  label: string;
}) {
  return (
    <div className="px-4 py-5 sm:px-5">
      <Icon className="mb-3 size-4 text-muted-foreground" />
      <p className="text-2xl font-bold">—</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
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
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
}
