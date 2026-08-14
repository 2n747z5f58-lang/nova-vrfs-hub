import { db, maybe, must } from '../supabase.js';
import type { Division, Fixture, Player, Team } from './types.js';

export class NotFoundError extends Error {}

const TEAM_COLS = 'id,name,slug,logo_url,league_id,division_id,budget,manager_id';
const PLAYER_COLS =
  'id,username,display_name,discord_id,team_id,loan_team_id,position,goals,assists,appearances';
const DIVISION_COLS = 'id,league_id,name,season,status,tier,start_date,gameweek_interval_days';

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export { slugify };

/** Resolves a team by exact name, slug, or partial name. */
export async function findTeam(query: string): Promise<Team> {
  const q = query.trim();
  const exact = maybe<Team[]>(
    await db.from('teams').select(TEAM_COLS).or(`name.ilike.${q},slug.eq.${slugify(q)}`).limit(2),
  );
  if (exact && exact.length === 1) return exact[0]!;
  const partial = must<Team[]>(await db.from('teams').select(TEAM_COLS).ilike('name', `%${q}%`).limit(5));
  if (partial.length === 0) throw new NotFoundError(`No team found matching \`${q}\`.`);
  if (partial.length > 1) {
    throw new NotFoundError(
      `Multiple teams match \`${q}\`: ${partial.map((t) => `**${t.name}**`).join(', ')}. Be more specific.`,
    );
  }
  return partial[0]!;
}

export async function getTeamById(id: string): Promise<Team> {
  const t = maybe<Team>(await db.from('teams').select(TEAM_COLS).eq('id', id).maybeSingle());
  if (!t) throw new NotFoundError('Team not found.');
  return t;
}

/**
 * Resolves a player from a Discord mention/id, username or display name.
 * Creates nothing — players must exist (they register on the website).
 */
export async function findPlayer(query: string): Promise<Player> {
  const raw = query.trim();
  const mention = raw.match(/^<@!?(\d+)>$/);
  const discordId = mention?.[1] ?? (/^\d{15,20}$/.test(raw) ? raw : null);

  if (discordId) {
    const byDiscord = maybe<Player>(
      await db.from('players').select(PLAYER_COLS).eq('discord_id', discordId).maybeSingle(),
    );
    if (byDiscord) return byDiscord;
    throw new NotFoundError(`<@${discordId}> is not registered as a NOVA player yet.`);
  }

  const rows = must<Player[]>(
    await db
      .from('players')
      .select(PLAYER_COLS)
      .or(`username.ilike.%${raw}%,display_name.ilike.%${raw}%`)
      .limit(5),
  );
  if (rows.length === 0) throw new NotFoundError(`No player found matching \`${raw}\`.`);
  if (rows.length > 1) {
    throw new NotFoundError(
      `Multiple players match \`${raw}\`: ${rows.map((p) => `**${p.display_name ?? p.username}**`).join(', ')}.`,
    );
  }
  return rows[0]!;
}

export async function findDivision(query: string): Promise<Division> {
  const raw = query.trim();
  const rows = must<Division[]>(
    await db.from('divisions').select(DIVISION_COLS).ilike('name', `%${raw}%`).limit(5),
  );
  if (rows.length === 0) throw new NotFoundError(`No division found matching \`${raw}\`.`);
  if (rows.length > 1) {
    throw new NotFoundError(`Multiple divisions match \`${raw}\`: ${rows.map((d) => `**${d.name}**`).join(', ')}.`);
  }
  return rows[0]!;
}

export async function findLeague(query?: string) {
  if (query) {
    const rows = must<{ id: string; name: string; slug: string }[]>(
      await db.from('leagues').select('id,name,slug').or(`name.ilike.%${query}%,slug.eq.${slugify(query)}`).limit(5),
    );
    if (rows.length === 0) throw new NotFoundError(`No league found matching \`${query}\`.`);
    if (rows.length > 1)
      throw new NotFoundError(`Multiple leagues match \`${query}\`: ${rows.map((l) => l.name).join(', ')}.`);
    return rows[0]!;
  }
  const all = must<{ id: string; name: string; slug: string }[]>(
    await db.from('leagues').select('id,name,slug').order('created_at').limit(2),
  );
  if (all.length === 0) throw new NotFoundError('No leagues exist yet. Create one on the NOVA website first.');
  return all[0]!;
}

/** The most recent non-completed fixture between two teams, else the latest fixture. */
export async function findFixtureBetween(teamAId: string, teamBId: string): Promise<Fixture> {
  const rows = must<Fixture[]>(
    await db
      .from('fixtures')
      .select('id,league_id,division_id,home_team_id,away_team_id,gameweek,kickoff_at,status,home_score,away_score')
      .or(
        `and(home_team_id.eq.${teamAId},away_team_id.eq.${teamBId}),and(home_team_id.eq.${teamBId},away_team_id.eq.${teamAId})`,
      )
      .order('kickoff_at', { ascending: true }),
  );
  if (rows.length === 0) throw new NotFoundError('No fixture exists between those teams.');
  return rows.find((f) => f.status !== 'completed') ?? rows[rows.length - 1]!;
}

/** Current gameweek number for a division (0 when the season has not started). */
export async function currentGameweek(divisionId: string): Promise<number> {
  const { data, error } = await db.rpc('current_gameweek', { _division_id: divisionId });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
