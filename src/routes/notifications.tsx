import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/notifications")({ component: Notifications });
function Notifications() { return <NovaPage title="Notifications" eyebrow="Activity feed" description="Stay informed about fixtures, results, league updates and favourite activity." emptyTitle="No notifications" emptyText="New updates from the connected NOVA database will appear here." />; }
