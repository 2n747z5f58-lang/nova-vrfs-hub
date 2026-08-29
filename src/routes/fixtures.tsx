import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/fixtures")({ component: Fixtures });
function Fixtures() { return <NovaPage title="Fixtures" eyebrow="Match centre" description="Upcoming, live, finished and postponed fixtures from your league data." emptyTitle="No fixtures available" emptyText="Fixtures will appear here once they are added to the connected database." />; }
