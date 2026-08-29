import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/teams")({ component: Teams });
function Teams() { return <NovaPage title="Teams" eyebrow="Club directory" description="Find registered VRFS teams, their competitions, squads and performance." emptyTitle="No teams registered" emptyText="Teams from the connected database will appear here." />; }
