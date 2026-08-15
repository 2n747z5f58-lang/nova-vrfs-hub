import { db, maybe } from '../supabase.js';
import type { Player, Profile, Team } from './types.js';

export type NovaRole = 'ADMIN' | 'OVERSEER' | 'MANAGER' | 'CO-MANAGER' | 'PLAYER';

export interface Actor {
  discordId: string;
  profile: Profile | null;
  roles: string[];
  /** Teams where this actor is manager or co-manager. */
  managedTeamIds: string[];
  player: Player | null;
}

/** Builds the full permission picture for a Discord user. */
export async function getActor(discordId: string): Promise<Actor> {
  const profile = maybe<Profile>(
    await db.from('profiles').select('id,discord_id,username,display_name').eq('discord_id', discordId).maybeSingle(),
  );
  const player = maybe<Player>(
    await db
      .from('players')
      .select('id,username,display_name,discord_id,team_id,loan_team_id,position,goals,assists,appearances')
      .eq('discord_id', discordId)
      .maybeSingle(),
  );

  let roles: string[] = [];
  const managedTeamIds = new Set<string>();

  if (profile) {
    const roleRows = maybe<{ role: string }[]>(
      await db.from('user_roles').select('role').eq('user_id', profile.id),
    );
    roles = (roleRows ?? []).map((r) => r.role);

    const owned = maybe<{ id: string }[]>(await db.from('teams').select('id').eq('manager_id', profile.id));
    (owned ?? []).forEach((t) => managedTeamIds.add(t.id));

    const staffRows = maybe<{ team_id: string; role: string }[]>(
      await db.from('team_staff').select('team_id,role').eq('user_id', profile.id),
    );
    (staffRows ?? [])
      .filter((s) => s.role === 'manager' || s.role === 'co_manager')
      .forEach((s) => managedTeamIds.add(s.team_id));
  }

  return { discordId, profile, roles, managedTeamIds: [...managedTeamIds], player };
}

export function isAdmin(actor: Actor) {
  return actor.roles.includes('ADMIN');
}

export function isStaff(actor: Actor) {
  return actor.roles.includes('ADMIN') || actor.roles.includes('OVERSEER');
}
export function managesTeam(actor: Actor, teamId: string | null | undefined) {
  return !!teamId && actor.managedTeamIds.includes(teamId);
}

export function highestRole(actor: Actor): NovaRole {
  if (actor.roles.includes('ADMIN')) return 'ADMIN';
  if (actor.roles.includes('OVERSEER')) return 'OVERSEER';
  if (actor.roles.includes('MANAGER')) return 'MANAGER';
  if (actor.roles.includes('CO-MANAGER')) return 'CO-MANAGER';
  return 'PLAYER';
}
export class PermissionError extends Error {}

/** Throws unless the actor is ADMIN or OVERSEER. */
export function requireStaff(actor: Actor) {
  if (!isStaff(actor)) {
    throw new PermissionError('This command is restricted to **ADMIN** and **OVERSEER** staff.');
  }
}

/** Throws unless the actor is staff or manages the given team. */
export function requireTeamControl(actor: Actor, team: Team | { id: string; name: string }) {
  if (isStaff(actor) || managesTeam(actor, team.id)) return;
  throw new PermissionError(`You must be **MANAGER** or **CO-MANAGER** of **${team.name}** (or staff) to do this.`);
}
