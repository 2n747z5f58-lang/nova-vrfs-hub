import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/admin")({ component: Admin });
function Admin() { return <NovaPage title="Admin" eyebrow="Operations" description="Manage NOVA users, roles and football operations with the appropriate Supabase permissions." emptyTitle="Admin access required" emptyText="Sign in with an authorized account to manage this workspace. Permissions are enforced by the database, not only by this interface." />; }
