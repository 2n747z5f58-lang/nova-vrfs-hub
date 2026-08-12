import { supabase } from "@/integrations/supabase/client";

/**
 * NOVA data access layer.
 * All database reads/writes for the platform live here so UI components stay
 * presentational and the backend can change without touching pages.
 */

export type FavouriteType = "league" | "team" | "player";

export interface League {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  season: string | null;
}

export interface Division {
  id: string;
  league_id: string;
  name: string;
  tier: number;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  league_id: string | null;
  division_id: string | null;
  leagues?: { name: string; slug: string } | null;
  divisions?: { name: string } | null;
}

export interface Player {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  discord_username: string | null;
  position: string | null;
  team_id: string | null;
  teams?: { id: string; name: string; slug: string; logo_url: string | null } | null;
}

export interface Fixture {
  id: string;
  league_id: string | null;
  division_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  competition: string | null;
  home_team?: { id: string; name: string; slug: string; logo_url: string | null } | null;
  away_team?: { id: string; name: string; slug: string; logo_url: string | null } | null;
  leagues?: { name: string; slug: string } | null;
  divisions?: { name: string } | null;
}

export interface StandingRow {
  id: string;
  division_id: string;
  team_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
  teams?: { id: string; name: string; slug: string; logo_url: string | null } | null;
}

export interface NovaNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  related_type: string | null;
  related_id: string | null;
  read: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  discord_username: string | null;
  discord_id: string | null;
  preferences: Record<string, unknown> | null;
}

const FIXTURE_SELECT =
  "*, home_team:teams!fixtures_home_team_id_fkey(id,name,slug,logo_url), away_team:teams!fixtures_away_team_id_fkey(id,name,slug,logo_url), leagues(name,slug), divisions(name)";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

/* ---------- Leagues / divisions ---------- */

export async function listLeagues() {
  return unwrap<League[]>(
    await supabase.from("leagues").select("*").order("name") as never,
  );
}

export async function getLeagueBySlug(slug: string) {
  const { data, error } = await supabase.from("leagues").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data as League | null;
}

export async function listDivisions(leagueId?: string) {
  let q = supabase.from("divisions").select("*").order("tier");
  if (leagueId) q = q.eq("league_id", leagueId);
  return unwrap<Division[]>((await q) as never);
}

/* ---------- Teams ---------- */

export async function listTeams(leagueId?: string) {
  let q = supabase.from("teams").select("*, leagues(name,slug), divisions(name)").order("name");
  if (leagueId) q = q.eq("league_id", leagueId);
  return unwrap<Team[]>((await q) as never);
}

export async function getTeamBySlug(slug: string) {
  const { data, error } = await supabase
    .from("teams")
    .select("*, leagues(name,slug), divisions(name)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Team | null;
}

export async function listStaff(teamId: string) {
  return unwrap<{ id: string; name: string; role: string }[]>(
    (await supabase.from("staff").select("*").eq("team_id", teamId).order("role")) as never,
  );
}

/* ---------- Players ---------- */

export async function listPlayers(opts: { search?: string; teamId?: string } = {}) {
  let q = supabase
    .from("players")
    .select("*, teams(id,name,slug,logo_url)")
    .order("username");
  if (opts.teamId) q = q.eq("team_id", opts.teamId);
  if (opts.search) q = q.or(`username.ilike.%${opts.search}%,display_name.ilike.%${opts.search}%`);
  return unwrap<Player[]>((await q) as never);
}

export async function getPlayer(id: string) {
  const { data, error } = await supabase
    .from("players")
    .select("*, teams(id,name,slug,logo_url)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Player | null;
}

export async function getPlayerStats(playerId: string) {
  const { data, error } = await supabase
    .from("match_events")
    .select("event_type")
    .eq("player_id", playerId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    goals: rows.filter((r) => r.event_type === "goal").length,
    assists: rows.filter((r) => r.event_type === "assist").length,
    appearances: new Set(rows.map(() => 1)).size ? rows.length : 0,
  };
}

export async function listTransfers(playerId?: string) {
  let q = supabase
    .from("transfers")
    .select(
      "*, players(id,username), from_team:teams!transfers_from_team_id_fkey(name,slug), to_team:teams!transfers_to_team_id_fkey(name,slug)",
    )
    .order("transfer_date", { ascending: false });
  if (playerId) q = q.eq("player_id", playerId);
  return unwrap<
    {
      id: string;
      transfer_date: string;
      details: string | null;
      players?: { id: string; username: string } | null;
      from_team?: { name: string; slug: string } | null;
      to_team?: { name: string; slug: string } | null;
    }[]
  >((await q) as never);
}

/* ---------- Fixtures / results ---------- */

export async function listFixturesBetween(fromISO: string, toISO: string) {
  return unwrap<Fixture[]>(
    (await supabase
      .from("fixtures")
      .select(FIXTURE_SELECT)
      .gte("kickoff_at", fromISO)
      .lte("kickoff_at", toISO)
      .order("kickoff_at")) as never,
  );
}

export async function listUpcomingFixtures(limit = 6, opts: { leagueId?: string; teamId?: string } = {}) {
  let q = supabase
    .from("fixtures")
    .select(FIXTURE_SELECT)
    .neq("status", "completed")
    .gte("kickoff_at", new Date(Date.now() - 3 * 3600_000).toISOString())
    .order("kickoff_at")
    .limit(limit);
  if (opts.leagueId) q = q.eq("league_id", opts.leagueId);
  if (opts.teamId) q = q.or(`home_team_id.eq.${opts.teamId},away_team_id.eq.${opts.teamId}`);
  return unwrap<Fixture[]>((await q) as never);
}

export async function listResults(limit = 10, opts: { leagueId?: string; teamId?: string } = {}) {
  let q = supabase
    .from("fixtures")
    .select(FIXTURE_SELECT)
    .eq("status", "completed")
    .order("kickoff_at", { ascending: false })
    .limit(limit);
  if (opts.leagueId) q = q.eq("league_id", opts.leagueId);
  if (opts.teamId) q = q.or(`home_team_id.eq.${opts.teamId},away_team_id.eq.${opts.teamId}`);
  return unwrap<Fixture[]>((await q) as never);
}

export async function listAllFixtures() {
  return unwrap<Fixture[]>(
    (await supabase.from("fixtures").select(FIXTURE_SELECT).order("kickoff_at", { ascending: false })) as never,
  );
}

/* ---------- Standings ---------- */

export async function listStandings(divisionId?: string) {
  let q = supabase
    .from("standings")
    .select("*, teams(id,name,slug,logo_url)")
    .order("points", { ascending: false });
  if (divisionId) q = q.eq("division_id", divisionId);
  return unwrap<StandingRow[]>((await q) as never);
}

export function sortStandings(rows: StandingRow[]) {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goals_for - b.goals_against - (a.goals_for - a.goals_against) ||
      b.goals_for - a.goals_for ||
      (a.teams?.name ?? "").localeCompare(b.teams?.name ?? ""),
  );
}

/* ---------- Favourites ---------- */

export async function listFavourites(userId: string) {
  return unwrap<{ id: string; item_type: FavouriteType; item_id: string }[]>(
    (await supabase.from("favourites").select("*").eq("user_id", userId)) as never,
  );
}

export async function addFavourite(userId: string, type: FavouriteType, itemId: string) {
  const { error } = await supabase
    .from("favourites")
    .insert({ user_id: userId, item_type: type, item_id: itemId });
  if (error && !error.message.includes("duplicate")) throw new Error(error.message);
}

export async function removeFavourite(userId: string, type: FavouriteType, itemId: string) {
  const { error } = await supabase
    .from("favourites")
    .delete()
    .eq("user_id", userId)
    .eq("item_type", type)
    .eq("item_id", itemId);
  if (error) throw new Error(error.message);
}

/* ---------- Notifications ---------- */

export async function listNotifications(userId: string) {
  return unwrap<NovaNotification[]>(
    (await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)) as never,
  );
}

export async function markNotificationRead(id: string, read = true) {
  const { error } = await supabase.from("notifications").update({ read }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw new Error(error.message);
}

/* ---------- Profile / roles ---------- */

export async function getProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Profile | null;
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function listMyRoles(userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) return [] as string[];
  return (data ?? []).map((r) => r.role as string);
}

/* ---------- Admin writes (RLS restricts these to admin/overseer) ---------- */

export async function adminInsert(table: string, values: Record<string, unknown>) {
  const { error } = await supabase.from(table as never).insert(values as never);
  if (error) throw new Error(error.message);
}

export async function adminUpdate(table: string, id: string, values: Record<string, unknown>) {
  const { error } = await supabase
    .from(table as never)
    .update(values as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminDelete(table: string, id: string) {
  const { error } = await supabase.from(table as never).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Records a result on a fixture; standings recalculate automatically in the database. */
export async function recordResult(fixtureId: string, homeScore: number, awayScore: number) {
  const { error } = await supabase
    .from("fixtures")
    .update({ home_score: homeScore, away_score: awayScore, status: "completed" })
    .eq("id", fixtureId);
  if (error) throw new Error(error.message);
  await supabase
    .from("results")
    .upsert({ fixture_id: fixtureId, home_score: homeScore, away_score: awayScore }, { onConflict: "fixture_id" });
}

/**
 * Fan-out helper: creates notifications for every user who favourited an item.
 * Used by admin actions (fixture release, result, goal, transfer) so the
 * favourite-notification pipeline is real rather than mocked.
 */
export async function notifyFavourites(input: {
  itemType: FavouriteType;
  itemId: string;
  type: string;
  title: string;
  message?: string;
}) {
  const { data, error } = await supabase
    .from("favourites")
    .select("user_id")
    .eq("item_type", input.itemType)
    .eq("item_id", input.itemId);
  if (error) throw new Error(error.message);
  const users = [...new Set((data ?? []).map((r) => r.user_id as string))];
  if (users.length === 0) return 0;
  const rows = users.map((user_id) => ({
    user_id,
    type: input.type,
    title: input.title,
    message: input.message ?? null,
    related_type: input.itemType,
    related_id: input.itemId,
  }));
  const { error: insErr } = await supabase.from("notifications").insert(rows);
  if (insErr) throw new Error(insErr.message);
  return rows.length;
}
