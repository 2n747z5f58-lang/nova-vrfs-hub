import { db, must } from '../supabase.js';
import type { Division, Team } from './types.js';

export interface GeneratedFixture {
  league_id: string | null;
  division_id: string;
  home_team_id: string;
  away_team_id: string;
  gameweek: number;
  kickoff_at: string;
  status: string;
  competition: string | null;
}

/**
 * Double round-robin (circle method): every team plays every other team home
 * and away. Returns rounds of pairings; a bye is represented by a null slot.
 */
export function roundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  const ids: (string | null)[] = [...teamIds];
  if (ids.length % 2 === 1) ids.push(null);
  const n = ids.length;
  const roundsPerHalf = n - 1;
  const half = n / 2;
  const firstHalf: Array<Array<[string, string]>> = [];

  let rotation = [...ids];
  for (let r = 0; r < roundsPerHalf; r++) {
    const round: Array<[string, string]> = [];
    for (let i = 0; i < half; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (!a || !b) continue;
      // Alternate home/away by round so fixtures stay balanced.
      round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    firstHalf.push(round);
    const fixed = rotation[0]!;
    const rest = rotation.slice(1);
    rest.unshift(rest.pop()!);
    rotation = [fixed, ...rest];
  }

  const secondHalf = firstHalf.map((round) => round.map(([h, a]) => [a, h] as [string, string]));
  return [...firstHalf, ...secondHalf];
}

/**
 * Generates the full fixture list + gameweek rows for a division.
 * Gameweek N kicks off `gameweek_interval_days * (N - 1)` days after start.
 */
export async function generateFixtures(division: Division, startDate: Date) {
  const teams = must<Team[]>(
    await db.from('teams').select('id,name,slug,logo_url,league_id,division_id,budget,manager_id').eq('division_id', division.id),
  );
  if (teams.length < 2) throw new Error(`**${division.name}** needs at least 2 teams before it can start.`);

  const rounds = roundRobin(teams.map((t) => t.id));
  const intervalMs = Math.max(1, division.gameweek_interval_days) * 86_400_000;

  const gameweekRows = rounds.map((_, i) => ({
    division_id: division.id,
    number: i + 1,
    starts_at: new Date(startDate.getTime() + i * intervalMs).toISOString(),
  }));

  const fixtures: GeneratedFixture[] = [];
  rounds.forEach((round, i) => {
    const kickoff = new Date(startDate.getTime() + i * intervalMs).toISOString();
    round.forEach(([home, away]) => {
      fixtures.push({
        league_id: division.league_id,
        division_id: division.id,
        home_team_id: home,
        away_team_id: away,
        gameweek: i + 1,
        kickoff_at: kickoff,
        status: 'scheduled',
        competition: division.name,
      });
    });
  });

  // Replace any previously generated schedule for this division.
  await db.from('fixtures').delete().eq('division_id', division.id).neq('status', 'completed');
  await db.from('gameweeks').delete().eq('division_id', division.id);

  const gwRes = await db.from('gameweeks').insert(gameweekRows);
  if (gwRes.error) throw new Error(gwRes.error.message);
  const fxRes = await db.from('fixtures').insert(fixtures);
  if (fxRes.error) throw new Error(fxRes.error.message);

  return { teams: teams.length, gameweeks: gameweekRows.length, fixtures: fixtures.length };
}
