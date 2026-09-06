import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { TableGenerator } from "@/components/nova/TableGenerator";
import { supabase } from "@/integrations/supabase/client";
type League = {
  id: string;
  name: string;
};
export const Route = createFileRoute("/table-generator")({
  ssr: false,
  component: TableGeneratorPage,
});
function TableGeneratorPage() {
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function loadLeague() {
      try {
        setLoading(true);
        setError(null);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("You must be logged in to use the Table Generator.");
          return;
        }
        const { data: membership, error: membershipError } =
          await supabase
            .from("league_members")
            .select("league_id")
            .eq("user_id", user.id)
            .in("role", ["overseer", "co_overseer"])
            .order("created_at", {
              ascending: true,
            })
            .limit(1)
            .maybeSingle();
        if (membershipError) {
          throw membershipError;
        }
        if (!membership?.league_id) {
          setError("You are not an Overseer or Co-Overseer of a league.");
          return;
        }
        const { data: leagueData, error: leagueError } =
          await supabase
            .from("leagues")
            .select("id,name")
            .eq("id", membership.league_id)
            .maybeSingle();
        if (leagueError) {
          throw leagueError;
        }
        if (!leagueData) {
          setError("Your league could not be found.");
          return;
        }
        if (!cancelled) {
          setLeague(leagueData as League);
        }
      } catch (err) {
        console.error(
          "Failed to load league for table generator:",
          err,
        );
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load your league.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadLeague();
    return () => {
      cancelled = true;
    };
  }, []);
  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-12 text-white">
        <div className="mx-auto flex min-h-[50vh] max-w-6xl items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-semibold text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading NOVA...
          </div>
        </div>
      </main>
    );
  }
  if (error || !league) {
    return (
      <main className="min-h-screen bg-black px-6 py-12 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            to="/league"
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to League Panel
          </Link>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
            <h1 className="text-xl font-black text-white">
              Table Generator unavailable
            </h1>
            <p className="mt-2 text-sm text-red-300">
              {error ?? "Your league could not be loaded."}
            </p>
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white md:px-8 md:py-12">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8">
          <Link
            to="/league"
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to League Panel
          </Link>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
              NOVA • League Tools
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">
              Table Generator
            </h1>
            <p className="mt-2 text-zinc-500">
              Create a branded standings graphic for{" "}
              <span className="font-bold text-zinc-300">
                {league.name}
              </span>
              .
            </p>
          </div>
        </div>
        <TableGenerator
          leagueId={league.id}
          leagueName={league.name}
        />
      </div>
    </main>
  );
}
