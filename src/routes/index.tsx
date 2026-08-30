
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowUpRight,
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
    <section className="py-7">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        </div>

        <Link
          to={"/fixtures" as any}
          className="text-xs text-muted-foreground transition hover:text-foreground"
        >
          View all <ChevronRight className="ml-1 inline size-3" />
        </Link>
      </div>

      <div className="flex min-h-32 items-center justify-center border-t border-border py-10 text-center">
        <div>
          <span className="mb-3 grid size-9 place-items-center text-muted-foreground">
            <Icon className="size-4" />
          </span>

          <p className="text-sm text-muted-foreground">{empty}</p>

          <p className="mt-1 text-xs text-muted-foreground/60">
            Connect your league data to see updates here.
          </p>
        </div>
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
            className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10"
          >
            {/* MATCH CENTRE HERO */}
            <section className="relative isolate mb-12 min-h-[520px] overflow-hidden md:min-h-[620px]">
              {/* Match graphic */}
              <img
                src="https://imagepaste.org/i/8gprh5q5.jpg"
                alt="Hannover 96 vs Queen Edith FC"
                className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
              />

              {/* Smooth fade into NOVA */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/10 via-black/25 to-background" />
              <div className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-background via-background/75 to-transparent" />

              {/* Match content */}
              <div className="relative flex min-h-[520px] flex-col justify-end pb-8 pt-40 md:min-h-[620px] md:pb-12">
                <div className="mb-5 flex items-center gap-5">
                  <div className="grid size-16 place-items-center rounded-full bg-black/70 p-2 backdrop-blur-sm md:size-20">
                    <img
                      src="https://imagepaste.org/i/uq8vd2hb.png"
                      alt="Hannover 96"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <span className="text-lg font-bold text-white/80 md:text-2xl">
                    VS
                  </span>

                  {/* White background of the Queen Edith image is hidden */}
                  <div className="grid size-16 place-items-center overflow-hidden rounded-full bg-black/70 p-2 backdrop-blur-sm md:size-20">
                    <img
                      src="https://imagepaste.org/i/zt8wruzz.png"
                      alt="Queen Edith FC"
                      className="max-h-full max-w-full object-contain mix-blend-multiply"
                    />
                  </div>
                </div>

                <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-white/75">
                  Match Centre
                </p>

                <h1 className="max-w-5xl text-4xl font-black uppercase leading-[0.95] tracking-[-0.055em] text-white drop-shadow-lg md:text-7xl">
                  Hannover 96
                  <span className="mx-3 text-white/60 md:mx-5">vs</span>
                  Queen Edith FC
                </h1>

                <p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-white/80">
                  VNO FA CUP FINAL
                </p>

                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/65">
                  4:30 PM K.O. · LIVE ON NOVA TV
                </p>

                <div className="mt-7">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white/55">
                    Kickoff countdown
                  </p>

                  <p className="text-3xl font-black tracking-tight text-white md:text-5xl">
                    {formatTimeLeft(timeLeft)}
                  </p>
                </div>
              </div>
            </section>

            {/* MATCH CENTRE */}
            <div className="mb-6">
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

            {/* QUICK STATS */}
            <div className="mb-6 grid grid-cols-2 border-y border-border md:grid-cols-4">
              <Stat icon={Trophy} label="Active leagues" />
              <Stat icon={CalendarDays} label="Fixtures tracked" />
              <Stat icon={Users} label="Registered teams" />
              <Stat icon={ShieldCheck} label="Players indexed" />
            </div>

            {/* FIXTURES */}
            <div className="divide-y divide-border">
              {sections.map(({ title, icon, empty }) => (
                <EmptyPanel
                  key={title}
                  title={title}
                  Icon={icon}
                  empty={empty}
                />
              ))}
            </div>

            {/* OTHER HOMEPAGE CONTENT */}
            <div className="mt-4 grid gap-10 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <EmptyPanel
                title="Featured leagues"
                Icon={Trophy}
                empty="No leagues created yet"
              />

              <div className="lg:pl-10">
                <EmptyPanel
                  title="Recent transfers"
                  Icon={Users}
                  empty="No transfers yet"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Link
                to={"/leagues" as any}
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                Explore leagues
                <ArrowUpRight className="size-4" />
              </Link>
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
    <div className="bg-card/40 px-4 py-5 first:border-l-0 md:px-5">
      <Icon className="mb-3 size-4 text-muted-foreground" />

      <p className="text-2xl font-bold">—</p>

      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
