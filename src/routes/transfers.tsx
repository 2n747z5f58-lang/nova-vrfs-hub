import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/transfers")({ component: Transfers });
function Transfers() { return <NovaPage title="Transfers" eyebrow="Movement log" description="Track signings, loans, releases and the complete transfer history." emptyTitle="No transfers yet" emptyText="Transfer activity will appear here when it is recorded." />; }
