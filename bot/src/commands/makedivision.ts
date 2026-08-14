import { SlashCommandBuilder } from 'discord.js';
import type { NovaCommand } from '../lib/command.js';
import { db, must } from '../supabase.js';
import { findLeague } from '../lib/resolve.js';
import { requireStaff } from '../lib/perms.js';
import { field, successEmbed } from '../lib/format.js';

export const makedivision: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('makedivision')
    .setDescription('Create a division (ADMIN / OVERSEER only)')
    .addStringOption((o) => o.setName('name').setDescription('Division name').setRequired(true))
    .addIntegerOption((o) => o.setName('tier').setDescription('Tier (1 = top)').setMinValue(1))
    .addStringOption((o) => o.setName('league').setDescription('Parent league'))
    .addStringOption((o) => o.setName('season').setDescription('Season label, e.g. S1'))
    .addIntegerOption((o) =>
      o.setName('interval_days').setDescription('Days between gameweeks (default 7)').setMinValue(1).setMaxValue(30),
    ),

  async execute(interaction, actor) {
    requireStaff(actor);
    const league = await findLeague(interaction.options.getString('league') ?? undefined);
    const name = interaction.options.getString('name', true).trim();
    const tier = interaction.options.getInteger('tier') ?? 1;
    const interval = interaction.options.getInteger('interval_days') ?? 7;

    const division = must<{ id: string; name: string }>(
      (await db
        .from('divisions')
        .insert({
          league_id: league.id,
          name,
          tier,
          season: interaction.options.getString('season'),
          status: 'draft',
          gameweek_interval_days: interval,
        })
        .select('id,name')
        .single()) as never,
    );

    await interaction.editReply({
      embeds: [
        successEmbed('Division created', `**${division.name}** is ready for clubs.`).addFields(
          field('League', league.name),
          field('Tier', String(tier)),
          field('Gameweek interval', `${interval} day(s)`),
          field('Next step', 'Add clubs with `/addteam`, then run `/startdivision`.', false),
        ),
      ],
    });
  },
};
