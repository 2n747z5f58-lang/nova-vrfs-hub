import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
export const Route = createFileRoute("/favourites")({ component: Favourites });
function Favourites() { return <NovaPage title="Favourites" eyebrow="Your watchlist" description="Keep the leagues, teams and players you follow close at hand." emptyTitle="No favourites yet" emptyText="Favourite records will appear here after you sign in and save something." />; }
