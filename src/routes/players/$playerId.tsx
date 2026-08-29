import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/players/$playerId")({ component: PlayerDetail });
function PlayerDetail() { return <NovaPage title="Player" eyebrow="Player detail" description="Profile, appearances, goals, assists, match history and transfers." emptyTitle="Player not found" emptyText="This player does not exist in the connected database." detail />; }
