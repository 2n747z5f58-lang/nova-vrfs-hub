import { Link } from "@tanstack/react-router";
import { sortStandings, type StandingRow } from "@/lib/nova/api";
import { TeamCrest } from "@/components/nova/Cards";
import { EmptyState } from "@/components/nova/Primitives";

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No standings yet." description="Standings appear once results are recorded." />;
  }
  const sorted = sortStandings(rows);
  return (
    <div className="nova-panel overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h, i) => (
              <th
                key={h}
                className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground ${
                  i > 1 ? "text-center" : ""
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="px-2 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
              <td className="px-2 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <TeamCrest name={row.teams?.name} logoUrl={row.teams?.logo_url} size={20} />
                  {row.teams ? (
                    <Link
                      to="/teams/$slug"
                      params={{ slug: row.teams.slug }}
                      className="min-w-0 truncate font-semibold hover:underline"
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
                <td key={idx} className="px-2 py-2 text-center tabular-nums text-muted-foreground">
                  {v}
                </td>
              ))}
              <td className="px-2 py-2 text-center font-bold tabular-nums">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
