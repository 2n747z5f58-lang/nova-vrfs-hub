import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/matches/$matchId")({ component: MatchDetail });
function MatchDetail() { return <NovaPage title="Match" eyebrow="Match detail" description="Score, events, player statistics and replay information when recorded." emptyTitle="Match not found" emptyText="This match does not exist in the connected database." detail />; }
