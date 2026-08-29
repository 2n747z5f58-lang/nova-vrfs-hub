import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/leagues/$leagueId")({ component: LeagueDetail });
function LeagueDetail() { return <NovaPage title="League" eyebrow="League detail" description="Teams, standings, fixtures, results and form for this competition." emptyTitle="League not found" emptyText="This league does not exist in the connected database." detail />; }
