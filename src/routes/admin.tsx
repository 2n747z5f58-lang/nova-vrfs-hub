import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  adminDelete,
  adminInsert,
  listAllFixtures,
  listDivisions,
  listLeagues,
  listPlayers,
  listTeams,
  listTransfers,
  notifyFavourites,
  recordResult,
} from "@/lib/nova/api";
import { EmptyState, PageHeader, SectionHeader } from "@/components/nova/Primitives";
import { shortDate, timeOf } from "@/lib/nova/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Overseer Admin — NOVA VRFS" },
      { name: "description", content: "NOVA Overseer admin: manage leagues, divisions, teams, players, fixtures, results and transfers." },
      { property: "og:title", content: "Overseer Admin — NOVA VRFS" },
      { property: "og:description", content: "Administer the NOVA VRFS platform." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const TABS = ["Leagues", "Divisions", "Teams", "Players", "Fixtures", "Results", "Transfers"] as const;

function Field({
  label,
  value,
  onChange,
  type = "text",
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  options?: { value: string; label: string }[] | undefined;
}) {
  return (
    <label className="block">
      <span className="nova-label mb-1 block">{label}</span>
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-sm border border-input bg-surface px-2 text-sm"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-border-strong"
        />
      )}
    </label>
  );
}

function AdminTable({
  rows,
  onDelete,
}: {
  rows: { id: string; cells: (string | number)[] }[];
  onDelete?: (id: string) => void;
}) {
  if (rows.length === 0) return <EmptyState title="Nothing here yet." />;
  return (
    <div className="nova-panel overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              {r.cells.map((c, i) => (
                <td key={i} className={cn("px-2 py-2", i === 0 && "font-semibold")}>
                  {c}
                </td>
              ))}
              {onDelete && (
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => onDelete(r.id)}
                    className="rounded-sm border border-border px-2 py-1 text-[10px] font-bold uppercase text-destructive"
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminPage() {
  const { user, isStaff, loading } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Leagues");
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const leagues = useQuery({ queryKey: ["leagues"], queryFn: listLeagues });
  const divisions = useQuery({ queryKey: ["divisions"], queryFn: () => listDivisions() });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => listTeams() });
  const players = useQuery({ queryKey: ["players", ""], queryFn: () => listPlayers() });
  const fixtures = useQuery({ queryKey: ["fixtures-all"], queryFn: listAllFixtures });
  const transfers = useQuery({ queryKey: ["transfers"], queryFn: () => listTransfers() });

  const refresh = () => queryClient.invalidateQueries();

  const create = useMutation({
    mutationFn: async (input: { table: string; values: Record<string, unknown> }) => {
      await adminInsert(input.table, input.values);
    },
    onSuccess: () => {
      toast.success("Created");
      setForm({});
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (input: { table: string; id: string }) => adminDelete(input.table, input.id),
    onSuccess: () => {
      toast.success("Deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const result = useMutation({
    mutationFn: async (input: { fixtureId: string; home: number; away: number }) => {
      await recordResult(input.fixtureId, input.home, input.away);
      const f = (fixtures.data ?? []).find((x) => x.id === input.fixtureId);
      if (f) {
        const title = `${f.home_team?.name ?? "Home"} ${input.home}-${input.away} ${f.away_team?.name ?? "Away"}`;
        for (const teamId of [f.home_team_id, f.away_team_id]) {
          if (teamId) {
            await notifyFavourites({ itemType: "team", itemId: teamId, type: "result", title, message: "Result recorded." });
          }
        }
        if (f.league_id) {
          await notifyFavourites({ itemType: "league", itemId: f.league_id, type: "result", title, message: "Result recorded." });
        }
      }
    },
    onSuccess: () => {
      toast.success("Result recorded, standings updated");
      setForm({});
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <p className="text-sm text-muted-foreground">Checking permissions…</p>;
  if (!user || !isStaff) {
    return (
      <div>
        <PageHeader title="Overseer admin" />
        <EmptyState
          title="Administrator access required."
          description="Your account needs the admin or overseer role. Roles are enforced by the database, so admin actions cannot be performed without them."
        />
      </div>
    );
  }

  const teamOptions = (teams.data ?? []).map((t) => ({ value: t.id, label: t.name }));
  const leagueOptions = (leagues.data ?? []).map((l) => ({ value: l.id, label: l.name }));
  const divisionOptions = (divisions.data ?? []).map((d) => ({ value: d.id, label: d.name }));

  return (
    <div className="space-y-5">
      <PageHeader title="Overseer admin" subtitle="Manage the NOVA VRFS platform" />

      <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setForm({});
            }}
            className={cn(
              "shrink-0 rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-wider",
              tab === t ? "border-foreground bg-surface-2" : "border-border text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Leagues" && (
        <>
          <SectionHeader title="Create league" />
          <div className="nova-panel grid gap-3 p-3 sm:grid-cols-2">
            <Field label="Name" value={form["name"] ?? ""} onChange={set("name")} />
            <Field label="Slug" value={form["slug"] ?? ""} onChange={set("slug")} />
            <Field label="Season" value={form["season"] ?? ""} onChange={set("season")} />
            <Field label="Logo URL" value={form["logo_url"] ?? ""} onChange={set("logo_url")} />
            <Field label="Description" value={form["description"] ?? ""} onChange={set("description")} />
            <button
              onClick={() =>
                create.mutate({
                  table: "leagues",
                  values: {
                    name: form["name"],
                    slug: form["slug"],
                    season: form["season"] || null,
                    logo_url: form["logo_url"] || null,
                    description: form["description"] || null,
                  },
                })
              }
              className="h-11 rounded-sm bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              Create league
            </button>
          </div>
          <SectionHeader title="Leagues" />
          <AdminTable
            rows={(leagues.data ?? []).map((l) => ({ id: l.id, cells: [l.name, l.season ?? "—", l.slug] }))}
            onDelete={(id) => remove.mutate({ table: "leagues", id })}
          />
        </>
      )}

      {tab === "Divisions" && (
        <>
          <SectionHeader title="Create division" />
          <div className="nova-panel grid gap-3 p-3 sm:grid-cols-2">
            <Field label="League" value={form["league_id"] ?? ""} onChange={set("league_id")} options={leagueOptions} />
            <Field label="Name" value={form["name"] ?? ""} onChange={set("name")} />
            <Field label="Tier" type="number" value={form["tier"] ?? ""} onChange={set("tier")} />
            <button
              onClick={() =>
                create.mutate({
                  table: "divisions",
                  values: { league_id: form["league_id"], name: form["name"], tier: Number(form["tier"] || 1) },
                })
              }
              className="h-11 rounded-sm bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              Create division
            </button>
          </div>
          <SectionHeader title="Divisions" />
          <AdminTable
            rows={(divisions.data ?? []).map((d) => ({
              id: d.id,
              cells: [d.name, `Tier ${d.tier}`, (leagues.data ?? []).find((l) => l.id === d.league_id)?.name ?? "—"],
            }))}
            onDelete={(id) => remove.mutate({ table: "divisions", id })}
          />
        </>
      )}

      {tab === "Teams" && (
        <>
          <SectionHeader title="Create team" />
          <div className="nova-panel grid gap-3 p-3 sm:grid-cols-2">
            <Field label="Name" value={form["name"] ?? ""} onChange={set("name")} />
            <Field label="Slug" value={form["slug"] ?? ""} onChange={set("slug")} />
            <Field label="Logo URL" value={form["logo_url"] ?? ""} onChange={set("logo_url")} />
            <Field label="League" value={form["league_id"] ?? ""} onChange={set("league_id")} options={leagueOptions} />
            <Field label="Division" value={form["division_id"] ?? ""} onChange={set("division_id")} options={divisionOptions} />
            <button
              onClick={() =>
                create.mutate({
                  table: "teams",
                  values: {
                    name: form["name"],
                    slug: form["slug"],
                    logo_url: form["logo_url"] || null,
                    league_id: form["league_id"] || null,
                    division_id: form["division_id"] || null,
                  },
                })
              }
              className="h-11 rounded-sm bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              Create team
            </button>
          </div>
          <SectionHeader title="Teams" />
          <AdminTable
            rows={(teams.data ?? []).map((t) => ({
              id: t.id,
              cells: [t.name, t.leagues?.name ?? "—", t.divisions?.name ?? "—"],
            }))}
            onDelete={(id) => remove.mutate({ table: "teams", id })}
          />
        </>
      )}

      {tab === "Players" && (
        <>
          <SectionHeader title="Create player" />
          <div className="nova-panel grid gap-3 p-3 sm:grid-cols-2">
            <Field label="Username" value={form["username"] ?? ""} onChange={set("username")} />
            <Field label="Display name" value={form["display_name"] ?? ""} onChange={set("display_name")} />
            <Field label="Position" value={form["position"] ?? ""} onChange={set("position")} />
            <Field label="Discord username" value={form["discord_username"] ?? ""} onChange={set("discord_username")} />
            <Field label="Team" value={form["team_id"] ?? ""} onChange={set("team_id")} options={teamOptions} />
            <button
              onClick={() =>
                create.mutate({
                  table: "players",
                  values: {
                    username: form["username"],
                    display_name: form["display_name"] || null,
                    position: form["position"] || null,
                    discord_username: form["discord_username"] || null,
                    team_id: form["team_id"] || null,
                  },
                })
              }
              className="h-11 rounded-sm bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              Create player
            </button>
          </div>
          <SectionHeader title="Players" />
          <AdminTable
            rows={(players.data ?? []).map((p) => ({
              id: p.id,
              cells: [p.username, p.position ?? "—", p.teams?.name ?? "Free agent"],
            }))}
            onDelete={(id) => remove.mutate({ table: "players", id })}
          />
        </>
      )}

      {tab === "Fixtures" && (
        <>
          <SectionHeader title="Release fixture" />
          <div className="nova-panel grid gap-3 p-3 sm:grid-cols-2">
            <Field label="League" value={form["league_id"] ?? ""} onChange={set("league_id")} options={leagueOptions} />
            <Field label="Division" value={form["division_id"] ?? ""} onChange={set("division_id")} options={divisionOptions} />
            <Field label="Home team" value={form["home_team_id"] ?? ""} onChange={set("home_team_id")} options={teamOptions} />
            <Field label="Away team" value={form["away_team_id"] ?? ""} onChange={set("away_team_id")} options={teamOptions} />
            <Field label="Kick-off" type="datetime-local" value={form["kickoff_at"] ?? ""} onChange={set("kickoff_at")} />
            <Field label="Competition" value={form["competition"] ?? ""} onChange={set("competition")} />
            <button
              onClick={async () => {
                try {
                  await adminInsert("fixtures", {
                    league_id: form["league_id"] || null,
                    division_id: form["division_id"] || null,
                    home_team_id: form["home_team_id"] || null,
                    away_team_id: form["away_team_id"] || null,
                    kickoff_at: new Date(form["kickoff_at"] ?? Date.now()).toISOString(),
                    competition: form["competition"] || null,
                    status: "scheduled",
                  });
                  const title = "New fixture released";
                  for (const teamId of [form["home_team_id"], form["away_team_id"]]) {
                    if (teamId) await notifyFavourites({ itemType: "team", itemId: teamId, type: "fixture", title, message: "A new NOVA VRFS fixture has been scheduled." });
                  }
                  if (form["league_id"]) {
                    await notifyFavourites({ itemType: "league", itemId: form["league_id"], type: "fixture", title, message: "New fixtures released for a league you follow." });
                  }
                  toast.success("Fixture released and notifications sent");
                  setForm({});
                  refresh();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              className="h-11 rounded-sm bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              Release fixture
            </button>
          </div>
          <SectionHeader title="Fixtures" />
          <AdminTable
            rows={(fixtures.data ?? []).map((f) => ({
              id: f.id,
              cells: [
                `${f.home_team?.name ?? "TBD"} v ${f.away_team?.name ?? "TBD"}`,
                `${shortDate(f.kickoff_at)} ${timeOf(f.kickoff_at)}`,
                f.status,
              ],
            }))}
            onDelete={(id) => remove.mutate({ table: "fixtures", id })}
          />
        </>
      )}

      {tab === "Results" && (
        <>
          <SectionHeader title="Record result" />
          <div className="nova-panel grid gap-3 p-3 sm:grid-cols-2">
            <Field
              label="Fixture"
              value={form["fixture_id"] ?? ""}
              onChange={set("fixture_id")}
              options={(fixtures.data ?? []).map((f) => ({
                value: f.id,
                label: `${f.home_team?.name ?? "TBD"} v ${f.away_team?.name ?? "TBD"} (${shortDate(f.kickoff_at)})`,
              }))}
            />
            <Field label="Home score" type="number" value={form["home"] ?? ""} onChange={set("home")} />
            <Field label="Away score" type="number" value={form["away"] ?? ""} onChange={set("away")} />
            <button
              onClick={() =>
                result.mutate({
                  fixtureId: form["fixture_id"] ?? "",
                  home: Number(form["home"] || 0),
                  away: Number(form["away"] || 0),
                })
              }
              className="h-11 rounded-sm bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              Record result
            </button>
          </div>
          <SectionHeader title="Completed matches" />
          <AdminTable
            rows={(fixtures.data ?? [])
              .filter((f) => f.status === "completed")
              .map((f) => ({
                id: f.id,
                cells: [
                  `${f.home_team?.name ?? "TBD"} ${f.home_score ?? 0}-${f.away_score ?? 0} ${f.away_team?.name ?? "TBD"}`,
                  shortDate(f.kickoff_at),
                  f.competition ?? "—",
                ],
              }))}
          />
        </>
      )}

      {tab === "Transfers" && (
        <>
          <SectionHeader title="Record transfer" />
          <div className="nova-panel grid gap-3 p-3 sm:grid-cols-2">
            <Field
              label="Player"
              value={form["player_id"] ?? ""}
              onChange={set("player_id")}
              options={(players.data ?? []).map((p) => ({ value: p.id, label: p.username }))}
            />
            <Field label="From team" value={form["from_team_id"] ?? ""} onChange={set("from_team_id")} options={teamOptions} />
            <Field label="To team" value={form["to_team_id"] ?? ""} onChange={set("to_team_id")} options={teamOptions} />
            <Field label="Details" value={form["details"] ?? ""} onChange={set("details")} />
            <button
              onClick={async () => {
                try {
                  await adminInsert("transfers", {
                    player_id: form["player_id"],
                    from_team_id: form["from_team_id"] || null,
                    to_team_id: form["to_team_id"] || null,
                    details: form["details"] || null,
                  });
                  const p = (players.data ?? []).find((x) => x.id === form["player_id"]);
                  if (form["player_id"]) {
                    await notifyFavourites({
                      itemType: "player",
                      itemId: form["player_id"],
                      type: "transfer",
                      title: `${p?.username ?? "Player"} has transferred`,
                      message: form["details"] || "A player you follow has changed team.",
                    });
                  }
                  toast.success("Transfer recorded");
                  setForm({});
                  refresh();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              className="h-11 rounded-sm bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              Record transfer
            </button>
          </div>
          <SectionHeader title="Transfers" />
          <AdminTable
            rows={(transfers.data ?? []).map((t) => ({
              id: t.id,
              cells: [
                t.players?.username ?? "—",
                `${t.from_team?.name ?? "Free agent"} → ${t.to_team?.name ?? "Free agent"}`,
                shortDate(t.transfer_date),
              ],
            }))}
            onDelete={(id) => remove.mutate({ table: "transfers", id })}
          />
        </>
      )}
    </div>
  );
}
