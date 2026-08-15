import { SlashCommandBuilder } from 'discord.js';
import type { NovaCommand } from '../lib/command.js';
import { db } from '../supabase.js';
import { findPlayer, findTeam, getTeamById } from '../lib/resolve.js';
import { requireTeamControl } from '../lib/perms.js';
import { field, money, successEmbed } from '../lib/format.js';
import { applyBudget } from '../lib/budget.js';
import { notifyFavourites } from '../lib/notify.js';

export const sign: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('sign')
    .setDescription('Sign a free agent to your club (MANAGER / CO-MANAGER / staff)')
    .addStringOption((o) => o.setName('player').setDescription('Player mention, ID or name').setRequired(true))
    .addStringOption((o) => o.setName('team').setDescription('Club (defaults to the club you manage)'))
    .addIntegerOption((o) => o.setName('fee').setDescription('Signing fee (deducted from budget)').setMinValue(0)),

  async execute(interaction, actor) {
    const player = await findPlayer(interaction.options.getString('player', true));
    const teamOpt = interaction.options.getString('team');
    const team = teamOpt
      ? await findTeam(teamOpt)
      : actor.managedTeamIds[0]
        ? await getTeamById(actor.managedTeamIds[0])
        : (() => {
            throw new Error('You do not manage a club — pass `team`.');
          })();

    requireTeamControl(actor, team);

    if (player.team_id === team.id) throw new Error(`That player already plays for **${team.name}**.`);
    if (player.team_id) {
      throw new Error('That player is contracted to another club — use `/transfer` instead.');
    }

    const fee = interaction.options.getInteger('fee') ?? 0;
    if (fee > 0) {
      await applyBudget({
        team,
        amount: -fee,
        type: 'signing',
        description: `Signed ${player.display_name ?? player.username}`,
        createdBy: actor.profile?.id ?? null,
      });
    }

    const upd = await db.from('players').update({ team_id: team.id, loan_team_id: null }).eq('id', player.id);
    if (upd.error) throw new Error(upd.error.message);

    await db.from('signings').insert({
      player_id: player.id,
      team_id: team.id,
      previous_team_id: null,
      signed_by: actor.profile?.id ?? null,
      details: fee > 0 ? `Free agent signing for ${fee}` : 'Free agent signing',
    });

    await db
      .from('team_members')
      .insert({ team_id: team.id, player_id: player.id, role: 'player', status: 'active' });

    const label = player.display_name ?? player.username;
    await notifyFavourites({
      itemType: 'team',
      itemId: team.id,
      type: 'signing',
      title: `${team.name} sign ${label}`,
      message: fee > 0 ? `Fee: ${money(fee)}` : 'Free agent',
    });

    await interaction.editReply({
      embeds: [
        successEmbed('Signing complete', `**${label}** has joined **${team.name}**.`).addFields(
          field('Fee', fee > 0 ? money(fee) : 'Free'),
          field('Position', player.position ?? '—'),
          field('Remaining budget', money(Number(team.budget ?? 0) - fee), false),
        ),
      ],
    });
  },
};
