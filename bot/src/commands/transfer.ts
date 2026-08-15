import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import type { NovaCommand } from '../lib/command.js';
import { db, must } from '../supabase.js';
import { findPlayer, findTeam, getTeamById } from '../lib/resolve.js';
import { requireTeamControl } from '../lib/perms.js';
import { field, money, novaEmbed } from '../lib/format.js';
import { OFFER_ACCEPT, OFFER_DECLINE } from '../lib/transfers.js';
import { notifyProfile } from '../lib/notify.js';

export const transfer: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Make a transfer offer for a player (MANAGER / CO-MANAGER / staff)')
    .addStringOption((o) => o.setName('player').setDescription('Player mention, ID or name').setRequired(true))
    .addIntegerOption((o) => o.setName('fee').setDescription('Transfer fee').setMinValue(0).setRequired(true))
    .addStringOption((o) => o.setName('to_team').setDescription('Buying club (defaults to your club)')),

  async execute(interaction, actor) {
    const player = await findPlayer(interaction.options.getString('player', true));
    const label = player.display_name ?? player.username;
    const toOpt = interaction.options.getString('to_team');
    const toTeam = toOpt
      ? await findTeam(toOpt)
      : actor.managedTeamIds[0]
        ? await getTeamById(actor.managedTeamIds[0])
        : (() => {
            throw new Error('You do not manage a club — pass `to_team`.');
          })();

    requireTeamControl(actor, toTeam);

    if (player.team_id === toTeam.id) throw new Error(`**${label}** already plays for **${toTeam.name}**.`);
    const fromTeam = player.team_id ? await getTeamById(player.team_id) : null;
    const fee = interaction.options.getInteger('fee', true);

    if (Number(toTeam.budget ?? 0) < fee) {
      throw new Error(`**${toTeam.name}** cannot afford ${money(fee)} — budget is ${money(Number(toTeam.budget ?? 0))}.`);
    }

    const offer = must<{ id: string }>(
      (await db
        .from('transfer_offers')
        .insert({
          player_id: player.id,
          from_team_id: fromTeam?.id ?? null,
          to_team_id: toTeam.id,
          offered_by: actor.profile?.id ?? null,
          fee,
          status: 'pending',
        })
        .select('id')
        .single()) as never,
    );

    const embed = novaEmbed(
      'Transfer offer',
      `**${toTeam.name}** have made an offer for **${label}**.`,
    ).addFields(
      field('From', fromTeam?.name ?? 'Free agent'),
      field('To', toTeam.name),
      field('Fee', money(fee)),
      field(
        'Who can respond',
        fromTeam ? `**${fromTeam.name}** MANAGER / CO-MANAGER (or staff)` : 'The player (or staff)',
        false,
      ),
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${OFFER_ACCEPT}:${offer.id}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${OFFER_DECLINE}:${offer.id}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger),
    );

    const message = await interaction.editReply({ embeds: [embed], components: [row] });
    await db.from('transfer_offers').update({ discord_message_id: message.id }).eq('id', offer.id);

    if (fromTeam?.manager_id) {
      await notifyProfile({
        profileId: fromTeam.manager_id,
        type: 'transfer_offer',
        title: `Offer received for ${label}`,
        message: `${toTeam.name} offer ${money(fee)}`,
        relatedType: 'player',
        relatedId: player.id,
      });
    } else if (player.profile_id) {
      await notifyProfile({
        profileId: player.profile_id,
        type: 'transfer_offer',
        title: `${toTeam.name} want to sign you`,
        message: `Offer: ${money(fee)}`,
        relatedType: 'player',
        relatedId: player.id,
      });
    }
  },
};
