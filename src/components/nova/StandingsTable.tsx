import { Link } from "@tanstack/react-router";
import { sortStandings, type StandingRow } from "@/lib/nova/api";
import { TeamCrest } from "@/components/nova/Cards";
import { EmptyState } from "@/components/nova/Primitives";
import { cn } from "@/lib/utils";

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No standings yet." description="Standings appear once results are recorded." />;
  }
  const sorted = sortStandings(rows);
  return (
    <div className="nova-panel overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h, i) => (
              <th
                key={h}
                className={cn(
                  "px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
                  i > 1 && "text-center",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.id}
              className="border-b border-border last:border-0 transition-colors hover:bg-surface-2"
            >
              <td className="px-3 py-2.5">
                <span
                  className={cn(
                    "inline-grid h-6 w-6 place-items-center rounded text-xs font-bold tabular-nums",
                    i === 0 && "bg-accent-green/15 text-accent-green",
                    i === 1 && "bg-surface-2 text-muted-foreground",
                    i === 2 && "bg-surface-2 text-muted-foreground",
                    i > 2 && "text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <TeamCrest name={row.teams?.name} logoUrl={row.teams?.logo_url} size={22} />
                  {row.teams ? (
                    <Link
                      to="/teams/$slug"
                      params={{ slug: row.teams.slug }}
                      className="min-w-0 truncate font-semibold text-foreground transition-colors hover:text-accent-green"
                    >
                      {row.teams.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </div>
              </td>
              {[
                row.played,
                row.won,
                row.drawn,
                row.lost,
                row.goals_for,
                row.goals_against,
                row.goals_for - row.goals_against,
              ].map((v, idx) => (
                <td
                  key={idx}
                  className={cn(
                    "px-3 py-2.5 text-center tabular-nums",
                    idx === 6 && v > 0 && "text-success",
                    idx === 6 && v < 0 && "text-destructive",
                    idx !== 6 && "text-muted-foreground",
                  )}
                >
                  {v > 0 && idx === 6 ? `+${v}` : v}
                </td>
              ))}
              <td className="px-3 py-2.5 text-center text-base font-black tabular-nums text-foreground">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
