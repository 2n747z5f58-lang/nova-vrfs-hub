import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { Fixture, League, Player, Team } from "@/lib/nova/api";
import { shortDate, timeOf } from "@/lib/nova/dates";
import { FavouriteButton } from "@/components/nova/FavouriteButton";
import { cn } from "@/lib/utils";

export function TeamCrest({
  name,
  logoUrl,
  size = 32,
}: {
  name?: string | null;
  logoUrl?: string | null;
  size?: number;
}) {
  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return logoUrl ? (
    <img
      src={logoUrl}
      alt={name ?? ""}
      style={{ height: size, width: size }}
      className="shrink-0 rounded-sm border border-border object-cover"
    />
  ) : (
    <span
      style={{ height: size, width: size, fontSize: size * 0.34 }}
      className="grid shrink-0 place-items-center rounded-sm border border-border bg-surface-2 font-bold text-muted-foreground"
    >
      {initials}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "border-border text-muted-foreground",
    live: "border-live/60 bg-live/10 text-live",
    postponed: "border-warning/50 text-warning",
    scheduled: "border-border text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        map[status] ?? map["scheduled"],
      )}
    >
      {status === "completed" ? "FT" : status}
    </span>
  );
}

export function MatchCard({
  fixture,
  showDate = false,
  favourited = false,
}: {
  fixture: Fixture;
  showDate?: boolean;
  favourited?: boolean;
}) {
  const done = fixture.status === "completed";
  return (
    <article className="nova-panel px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="truncate">
          {fixture.competition ?? fixture.leagues?.name ?? "NOVA VRFS"}
          {fixture.divisions?.name ? ` · ${fixture.divisions.name}` : ""}
        </span>
        {favourited && <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />}
        <span className="ml-auto shrink-0">
          {showDate ? `${shortDate(fixture.kickoff_at)} · ` : ""}
          {timeOf(fixture.kickoff_at)}
        </span>
        <StatusBadge status={fixture.status} />
      </div>
      <div className="space-y-1.5">
        {[
          { team: fixture.home_team, score: fixture.home_score, home: true },
          { team: fixture.away_team, score: fixture.away_score, home: false },
        ].map((side, i) => (
          <div key={i} className="flex min-w-0 items-center gap-2">
            <TeamCrest name={side.team?.name} logoUrl={side.team?.logo_url} size={24} />
            {side.team ? (
              <Link
                to="/teams/$slug"
                params={{ slug: side.team.slug }}
                className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline"
              >
                {side.team.name}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">TBD</span>
            )}
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {done ? (side.score ?? 0) : ""}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

/** Compact preview used when browsing other dates. */
export function MatchMiniPreview({ fixture }: { fixture: Fixture }) {
  return (
    <article className="nova-panel w-[180px] shrink-0 px-3 py-2.5">
      <p className="nova-label truncate">
        {new Date(fixture.kickoff_at).toLocaleDateString(undefined, { weekday: "long" })}
      </p>
      <p className="mt-0.5 text-lg font-black tabular-nums">{timeOf(fixture.kickoff_at)}</p>
      <div className="mt-2 space-y-1 text-xs font-semibold">
        <p className="truncate">{fixture.home_team?.name ?? "TBD"}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">vs</p>
        <p className="truncate">{fixture.away_team?.name ?? "TBD"}</p>
      </div>
      <p className="mt-2 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
        {fixture.competition ?? fixture.leagues?.name ?? "NOVA VRFS"}
      </p>
    </article>
  );
}

export function TeamCard({ team }: { team: Team }) {
  return (
    <div className="nova-panel flex items-center gap-3 px-3 py-2.5">
      <TeamCrest name={team.name} logoUrl={team.logo_url} />
      <Link to="/teams/$slug" params={{ slug: team.slug }} className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{team.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {team.leagues?.name ?? "Unassigned"}
          {team.divisions?.name ? ` · ${team.divisions.name}` : ""}
        </p>
      </Link>
      <FavouriteButton type="team" itemId={team.id} size="icon" />
    </div>
  );
}

export function PlayerCard({ player }: { player: Player }) {
  return (
    <div className="nova-panel flex items-center gap-3 px-3 py-2.5">
      {player.avatar_url ? (
        <img
          src={player.avatar_url}
          alt={player.username}
          className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
        />
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-xs font-bold text-muted-foreground">
          {player.username.slice(0, 2).toUpperCase()}
        </span>
      )}
      <Link to="/players/$playerId" params={{ playerId: player.id }} className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{player.username}</p>
        <p className="truncate text-xs text-muted-foreground">
          {player.position ?? "VRFS Player"}
          {player.teams?.name ? ` · ${player.teams.name}` : " · Free agent"}
        </p>
      </Link>
      <FavouriteButton type="player" itemId={player.id} size="icon" />
    </div>
  );
}

export function LeagueCard({ league }: { league: League }) {
  return (
    <div className="nova-panel flex items-center gap-3 px-3 py-2.5">
      <TeamCrest name={league.name} logoUrl={league.logo_url} />
      <Link to="/leagues/$slug" params={{ slug: league.slug }} className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{league.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {league.season ?? "VRFS competition"}
        </p>
      </Link>
      <FavouriteButton type="league" itemId={league.id} size="icon" />
    </div>
  );
}
