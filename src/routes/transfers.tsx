import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
type Transfer = {
  id: string;
  player_id: string | null;
  from_team_id: string | null;
  to_team_id: string | null;
  transfer_type: string | null;
  fee: number | null;
  created_at: string;
  player?: {
    id: string;
    display_name: string | null;
    username: string | null;
  } | null;
  from_team?: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
  to_team?: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
};
export const Route = createFileRoute("/transfers")({
  component: Transfers,
});
function Transfers() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadTransfers();
  }, []);
  async function loadTransfers() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("transfers")
      .select(`
        id,
        player_id,
        from_team_id,
        to_team_id,
        transfer_type,
        fee,
        created_at,
        player:players (
          id,
          display_name,
          username
        ),
        from_team:teams!transfers_from_team_id_fkey (
          id,
          name,
          logo_url
        ),
        to_team:teams!transfers_to_team_id_fkey (
          id,
          name,
          logo_url
        )
      `)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load transfers:", error);
      setError("Couldn't load transfers.");
      setLoading(false);
      return;
    }
    setTransfers((data ?? []) as Transfer[]);
    setLoading(false);
  }
  function playerName(player: Transfer["player"]) {
    return (
      player?.display_name ??
      player?.username ??
      "Unknown player"
    );
  }
  function formatDate(date: string) {
    return new Date(date).toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  function formatFee(fee: number | null) {
    if (fee === null || fee === undefined) {
      return null;
    }
    return `£${fee.toLocaleString()}`;
  }
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading transfers...
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Movement log
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Transfers
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signings, loans, releases and transfer history.
          </p>
        </div>
        {transfers.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border">
              <UserRound className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">
              No transfers yet
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Transfer activity will appear here when it is recorded.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            {transfers.map((transfer, index) => {
              const fee = formatFee(transfer.fee);
              return (
                <div
                  key={transfer.id}
                  className={`p-5 md:p-6 ${
                    index !== transfers.length - 1 ? "border-b" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">
                        {playerName(transfer.player)}
                      </h2>
                      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                        {transfer.transfer_type ?? "Transfer"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(transfer.created_at)}
                    </span>
                  </div>
                  <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <TransferTeam
                      name={transfer.from_team?.name ?? "Free agent"}
                      logo={transfer.from_team?.logo_url ?? null}
                    />
                    <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
                    <TransferTeam
                      name={transfer.to_team?.name ?? "Free agent"}
                      logo={transfer.to_team?.logo_url ?? null}
                    />
                  </div>
                  {fee && (
                    <div className="mt-5 border-t pt-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        Fee
                      </span>
                      <span className="ml-2 text-sm font-semibold">
                        {fee}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
function TransferTeam({
  name,
  logo,
}: {
  name: string;
  logo: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
        {logo ? (
          <img
            src={logo}
            alt=""
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-sm font-bold text-muted-foreground">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="truncate text-sm font-semibold">
        {name}
      </span>
    </div>
  );
}
