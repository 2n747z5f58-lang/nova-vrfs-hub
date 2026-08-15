import { SlashCommandBuilder } from 'discord.js';
import type { NovaCommand } from '../lib/command.js';
import { db, maybe } from '../supabase.js';
import { currentGameweek, findPlayer, getTeamById } from '../lib/resolve.js';
import { PermissionError, isStaff, managesTeam } from '../lib/perms.js';
import { field, successEmbed } from '../lib/format.js';
import { notifyFavourites, notifyProfile } from '../lib/notify.js';
import type { Loan } from '../lib/types.js';

/** NOVA rule: a loaned player must complete 5 gameweeks before a recall. */
export const RECALL_MIN_GAMEWEEKS = 5;

export const recall: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('recall')
    .setDescription('Recall a player from loan (parent club management or staff) — 5 gameweek minimum')
    .addStringOption((o) => o.setName('player').setDescription('Player mention, ID or name').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason shown to the loan club')),

  async execute(interaction, actor) {
    const player = await findPlayer(interaction.options.getString('player', true));
    const label = player.display_name ?? player.username;

    const loan = maybe<Loan>(
      await db
        .from('loans')
        .select(
          'id,player_id,parent_team_id,loan_team_id,division_id,start_gameweek,start_date,end_gameweek,end_date,status',
        )
        .eq('player_id', player.id)
        .eq('status', 'active')
        .maybeSingle(),
    );
    if (!loan) throw new Error(`**${label}** is not currently out on loan.`);

    const parentTeam = loan.parent_team_id ? await getTeamById(loan.parent_team_id) : null;
    const loanTeam = await getTeamById(loan.loan_team_id);

    if (!isStaff(actor) && !(parentTeam && managesTeam(actor, parentTeam.id))) {
      throw new PermissionError(
        `Only ${parentTeam ? `**${parentTeam.name}** management` : 'the parent club'} (or staff) can recall this player.`,
      );
    }

    const gw = loan.division_id ? await currentGameweek(loan.division_id) : 0;
    const elapsed = gw - loan.start_gameweek;
    if (!isStaff(actor) && elapsed < RECALL_MIN_GAMEWEEKS) {
      throw new Error(
        `**${label}** has only completed **${Math.max(0, elapsed)}** of the required **${RECALL_MIN_GAMEWEEKS}** loan gameweeks. Earliest recall: **GW ${loan.start_gameweek + RECALL_MIN_GAMEWEEKS}**.`,
      );
    }

    const upd = await db
      .from('loans')
      .update({ status: 'recalled', end_gameweek: gw, end_date: new Date().toISOString() })
      .eq('id', loan.id);
    if (upd.error) throw new Error(upd.error.message);

    await db.from('loan_events').insert({
      loan_id: loan.id,
      event_type: 'recall',
      gameweek: gw,
      details: interaction.options.getString('reason') ?? `Recalled by ${actor.profile?.username ?? 'staff'}`,
    });

    const pupd = await db.from('players').update({ loan_team_id: null }).eq('id', player.id);
    if (pupd.error) throw new Error(pupd.error.message);

    if (loanTeam.manager_id) {
      await notifyProfile({
        profileId: loanTeam.manager_id,
        type: 'loan_recall',
        title: `${label} has been recalled`,
        message: `${parentTeam?.name ?? 'The parent club'} has ended the loan.`,
        relatedType: 'player',
        relatedId: player.id,
      });
    }
    await notifyFavourites({
      itemType: 'player',
      itemId: player.id,
      type: 'loan_recall',
      title: `${label} recalled from ${loanTeam.name}`,
    });

    await interaction.editReply({
      embeds: [
        successEmbed('Player recalled', `**${label}** returns to **${parentTeam?.name ?? 'their parent club'}**.`).addFields(
          field('Loan club', loanTeam.name),
          field('Loan length', `${Math.max(0, elapsed)} GW`),
          field('Recalled at', `GW ${gw}`),
        ),
      ],
    });
  },
};
