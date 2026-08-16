import {
  ActionRowBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type RoleSelectMenuInteraction,
} from 'discord.js';
import { db, maybe } from '../supabase.js';
import { field, novaEmbed } from './format.js';
import { PermissionError } from './perms.js';

export interface GuildSettings {
  guild_id: string;
  guild_name: string | null;
  manager_role_id: string | null;
  co_manager_role_id: string | null;
  player_role_id: string | null;
  updated_by_discord_id: string | null;
}

/** Slot keys map 1:1 onto the configurable role columns. */
export const ROLE_SLOTS = {
  manager: { column: 'manager_role_id', label: 'Manager role' },
  co_manager: { column: 'co_manager_role_id', label: 'Co-Manager role' },
  player: { column: 'player_role_id', label: 'Player role' },
} as const;

export type RoleSlot = keyof typeof ROLE_SLOTS;

export const SETUP_SELECT = 'nova:setup:role';

export function isRoleSlot(value: string): value is RoleSlot {
  return Object.prototype.hasOwnProperty.call(ROLE_SLOTS, value);
}

/**
 * Discord's native Administrator permission is the only gate for the panel.
 * No NOVA role or hard-coded role ID is involved.
 */
export function requireDiscordAdministrator(
  interaction: ChatInputCommandInteraction | RoleSelectMenuInteraction,
) {
  if (!interaction.inGuild()) {
    throw new PermissionError('Run this inside a Discord server so NOVA knows which server to configure.');
  }
  const permissions = interaction.memberPermissions;
  if (!permissions?.has(PermissionFlagsBits.Administrator)) {
    throw new PermissionError('Only members with the Discord **Administrator** permission can open the NOVA setup panel.');
  }
}

export async function getGuildSettings(guildId: string): Promise<GuildSettings | null> {
  return maybe<GuildSettings>(
    await db
      .from('guild_settings')
      .select('guild_id,guild_name,manager_role_id,co_manager_role_id,player_role_id,updated_by_discord_id')
      .eq('guild_id', guildId)
      .maybeSingle(),
  );
}

export async function saveRoleSetting(input: {
  guildId: string;
  guildName: string | null;
  slot: RoleSlot;
  roleId: string | null;
  actorDiscordId: string;
}): Promise<GuildSettings> {
  const { error, data } = await db
    .from('guild_settings')
    .upsert(
      {
        guild_id: input.guildId,
        guild_name: input.guildName,
        [ROLE_SLOTS[input.slot].column]: input.roleId,
        updated_by_discord_id: input.actorDiscordId,
      },
      { onConflict: 'guild_id' },
    )
    .select('guild_id,guild_name,manager_role_id,co_manager_role_id,player_role_id,updated_by_discord_id')
    .single();

  if (error) throw new Error(`Could not save the setting: ${error.message}`);
  return data as GuildSettings;
}

function mention(roleId: string | null | undefined) {
  return roleId ? `<@&${roleId}>` : 'Not set';
}

export function setupPanel(guildName: string, settings: GuildSettings | null, note?: string) {
  const embed = novaEmbed(
    'NOVA setup panel',
    note ?? `Server role configuration for **${guildName}**. Pick a Discord role for each NOVA role below — changes save immediately.`,
  ).addFields(
    field('Manager', mention(settings?.manager_role_id), false),
    field('Co-Manager', mention(settings?.co_manager_role_id), false),
    field('Player', mention(settings?.player_role_id), false),
  );

  const rows = (Object.keys(ROLE_SLOTS) as RoleSlot[]).map((slot) =>
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`${SETUP_SELECT}:${slot}`)
        .setPlaceholder(`Select the ${ROLE_SLOTS[slot].label}`)
        .setMinValues(0)
        .setMaxValues(1),
    ),
  );

  return { embeds: [embed], components: rows };
}
