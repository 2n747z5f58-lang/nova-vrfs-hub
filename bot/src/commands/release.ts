import { SlashCommandBuilder } from 'discord.js';
import type { NovaCommand } from '../lib/command.js';
import { db } from '../supabase.js';
import { findPlayer, getTeamById } from '../lib/resolve.js';
import { requireTeamControl } from '../lib/perms.js';
import { field, successEmbed } from '../lib/format.js';
import { notifyFavourites, notifyProfile } from '../lib/notify.js';

export const release: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('release')
    .setDescription('Release a player from your club (MANAGER / CO-MANAGER / staff)')
    .addStringOption((o) => o.setName('player').setDescription('Player mention, ID or name').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the release')),

  async execute(interaction, actor) {
    const player = await findPlayer(interaction.options.getString('player', true));
    const label = player.display_name ?? player.username;
    if (!player.team_id) throw new Error(`**${label}** is already a free agent.`);

    const team = await getTeamById(player.team_id);
    requireTeamControl(actor, team);

    // Close any active loan first so the player is fully free.
    await db
      .from('loans')
      .update({ status: 'ended', end_date: new Date().toISOString() })
      .eq('player_id', player.id)
      .eq('status', 'active');

    const upd = await db.from('players').update({ team_id: null, loan_team_id: null }).eq('id', player.id);
    if (upd.error) throw new Error(upd.error.message);

    await db.from('releases').insert({
      player_id: player.id,
      team_id: team.id,
      released_by: actor.profile?.id ?? null,
      reason: interaction.options.getString('reason') ?? null,
    });

    await db
      .from('team_members')
      .update({ status: 'left', left_at: new Date().toISOString() })
      .eq('team_id', team.id)
      .eq('player_id', player.id)
      .eq('status', 'active');

    if (player.profile_id) {
      await notifyProfile({
        profileId: player.profile_id,
        type: 'release',
        title: `You have been released by ${team.name}`,
        message: interaction.options.getString('reason') ?? undefined,
        relatedType: 'team',
        relatedId: team.id,
      });
    }
    await notifyFavourites({
      itemType: 'team',
      itemId: team.id,
      type: 'release',
      title: `${team.name} release ${label}`,
    });

    await interaction.editReply({
      embeds: [
        successEmbed('Player released', `**${label}** has left **${team.name}** and is now a free agent.`).addFields(
          field('Club', team.name),
          field('Reason', interaction.options.getString('reason') ?? '—', false),
        ),
      ],
    });
  },
};
