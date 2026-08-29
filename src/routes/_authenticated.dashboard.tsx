import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });
function Dashboard() { return <NovaPage title="Dashboard" eyebrow="VRFS / Control centre" description="Your authenticated NOVA workspace for leagues, fixtures and football operations." emptyTitle="No football data yet" emptyText="Connect your existing Supabase data to populate the dashboard." />; }
