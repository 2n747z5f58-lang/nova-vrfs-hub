import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/results")({ component: Results });
function Results() { return <NovaPage title="Results" eyebrow="Final scores" description="Review completed matches, scorelines and competition outcomes." emptyTitle="No results available" emptyText="Completed matches will appear here when result data exists." />; }
