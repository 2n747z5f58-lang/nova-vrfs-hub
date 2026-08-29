import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/teams/$teamId")({ component: TeamDetail });
function TeamDetail() { return <NovaPage title="Team" eyebrow="Team detail" description="Squad, staff, fixtures, results and statistics for this team." emptyTitle="Team not found" emptyText="This team does not exist in the connected database." detail />; }
