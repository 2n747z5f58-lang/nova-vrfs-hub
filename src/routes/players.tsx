import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/players")({ component: Players });
function Players() { return <NovaPage title="Players" eyebrow="Player index" description="Explore player profiles, positions, match history and career movement." emptyTitle="No players found" emptyText="Player profiles will appear here when they exist in the connected database." />; }
