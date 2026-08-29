import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/leagues")({ component: Leagues });
function Leagues() { return <NovaPage title="Leagues" eyebrow="Competition index" description="Browse every VRFS league and its competition structure from one focused view." emptyTitle="No leagues yet" emptyText="Leagues created in your connected NOVA database will appear here." />; }
