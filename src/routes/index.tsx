import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpRight, CalendarDays, ChevronRight, Clock3, ShieldCheck, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { NovaHeader, NovaSidebar } from "../components/nova/NovaSidebar";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" as any });
  },
  head: () => ({ meta: [{ title: "NOVA — VRFS Esports Football" }, { name: "description", content: "NOVA is the professional statistics and league-management platform for VRFS esports football." }] }),
  component: Index,
});

const sections = [
  { title: "Today's fixtures", icon: CalendarDays, empty: "No fixtures scheduled for today" },
  { title: "Upcoming fixtures", icon: Clock3, empty: "No upcoming fixtures" },
  { title: "Recent results", icon: Trophy, empty: "No results available" },
];

function EmptyPanel({ title, empty, Icon }: { title: string; empty: string; Icon: typeof CalendarDays }) { return <section className="border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-3"><Icon className="size-4 text-primary" /><h2 className="text-sm font-semibold tracking-wide">{title}</h2></div><Link to={"/fixtures" as any} className="text-xs text-muted-foreground hover:text-primary">View all <ChevronRight className="ml-1 inline size-3" /></Link></div><div className="flex min-h-36 flex-col items-center justify-center px-5 text-center"><span className="mb-3 grid size-10 place-items-center border border-dashed border-border text-muted-foreground"><Icon className="size-4" /></span><p className="text-sm text-muted-foreground">{empty}</p><p className="mt-1 text-xs text-muted-foreground/70">Connect your league data to see updates here.</p></div></section> }

function Index() { const [mobileOpen, setMobileOpen] = useState(false); return <div className="min-h-screen bg-background text-foreground"><div className="flex min-h-screen"><NovaSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} /><div className="min-w-0 flex-1"><NovaHeader onMenu={() => setMobileOpen(true)} /><main id="main" className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8"><div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">VRFS / Control centre</p><h1 className="text-3xl font-bold tracking-tight md:text-4xl">Good evening, football.</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Your live view of leagues, fixtures and the people shaping the VRFS season.</p></div><Link to={"/leagues" as any} className="inline-flex items-center gap-2 border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85">Explore leagues <ArrowUpRight className="size-4" /></Link></div><div className="mb-8 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4"><Stat icon={Trophy} label="Active leagues" /><Stat icon={CalendarDays} label="Fixtures tracked" /><Stat icon={Users} label="Registered teams" /><Stat icon={ShieldCheck} label="Players indexed" /></div><div className="grid gap-5 xl:grid-cols-2">{sections.map(({ title, icon, empty }) => <EmptyPanel key={title} title={title} Icon={icon} empty={empty} />)}</div><div className="mt-5 grid gap-5 lg:grid-cols-2"><EmptyPanel title="Featured leagues" Icon={Trophy} empty="No leagues created yet" /><EmptyPanel title="Recent transfers" Icon={Users} empty="No transfers yet" /></div></main></div></div></div> }
function Stat({ icon: Icon, label }: { icon: typeof Trophy; label: string }) { return <div className="bg-card px-4 py-5"><Icon className="mb-3 size-4 text-muted-foreground" /><p className="text-2xl font-bold">—</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div> }
