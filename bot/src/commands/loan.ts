import { SlashCommandBuilder } from 'discord.js';
import type { NovaCommand } from '../lib/command.js';
import { db, must } from '../supabase.js';
import { currentGameweek, findPlayer, findTeam, getTeamById } from '../lib/resolve.js';
import { PermissionError, isStaff, managesTeam } from '../lib/perms.js';
import { field, successEmbed } from '../lib/format.js';
import { notifyFavourites } from '../lib/notify.js';

export const loan: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('loan')
    .setDescription('Loan one of your players to another club (parent club MANAGER / CO-MANAGER / staff)')
    .addStringOption((o) => o.setName('player').setDescription('Player mention, ID or name').setRequired(true))
    .addStringOption((o) => o.setName('to_team').setDescription('Club receiving the player').setRequired(true)),

  async execute(interaction, actor) {
    const player = await findPlayer(interaction.options.getString('player', true));
    const loanTeam = await findTeam(interaction.options.getString('to_team', true));
    const label = player.display_name ?? player.username;

    if (!player.team_id) throw new Error(`**${label}** is a free agent — sign them first with \`/sign\`.`);
    const parentTeam = await getTeamById(player.team_id);
    if (parentTeam.id === loanTeam.id) throw new Error('A player cannot be loaned to their own club.');

    if (!isStaff(actor) && !managesTeam(actor, parentTeam.id)) {
      throw new PermissionError(`Only **${parentTeam.name}** management (or staff) can loan this player out.`);
    }

    const active = must<{ id: string }[]>(
      await db.from('loans').select('id').eq('player_id', player.id).eq('status', 'active'),
    );
    if (active.length > 0) throw new Error(`**${label}** is already out on loan. Use \`/recall\` first.`);

    const divisionId = loanTeam.division_id ?? parentTeam.division_id ?? null;
    const startGameweek = divisionId ? await currentGameweek(divisionId) : 0;

    const created = must<{ id: string }>(
      (await db
        .from('loans')
        .insert({
          player_id: player.id,
          parent_team_id: parentTeam.id,
          loan_team_id: loanTeam.id,
          division_id: divisionId,
          start_gameweek: startGameweek,
          start_date: new Date().toISOString(),
          status: 'active',
        })
        .select('id')
        .single()) as never,
    );

    await db.from('loan_events').insert({
      loan_id: created.id,
      event_type: 'loan_start',
      gameweek: startGameweek,
      details: `${parentTeam.name} → ${loanTeam.name}`,
    });

    const upd = await db.from('players').update({ loan_team_id: loanTeam.id }).eq('id', player.id);
    if (upd.error) throw new Error(upd.error.message);

    await notifyFavourites({
      itemType: 'team',
      itemId: loanTeam.id,
      type: 'loan',
      title: `${loanTeam.name} sign ${label} on loan`,
      message: `From ${parentTeam.name}`,
    });

    await interaction.editReply({
      embeds: [
        successEmbed('Loan agreed', `**${label}** joins **${loanTeam.name}** on loan.`).addFields(
          field('Parent club', parentTeam.name),
          field('Started', `GW ${startGameweek}`),
          field(
            'Recall rule',
            `Cannot be recalled until **GW ${startGameweek + 5}** (5 gameweeks minimum).`,
            false,
          ),
        ),
      ],
    });
  },
};
