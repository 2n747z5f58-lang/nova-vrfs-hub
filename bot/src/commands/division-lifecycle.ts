import { SlashCommandBuilder } from 'discord.js';
import type { NovaCommand } from '../lib/command.js';
import { db } from '../supabase.js';
import { findDivision } from '../lib/resolve.js';
import { requireStaff } from '../lib/perms.js';
import { field, successEmbed } from '../lib/format.js';
import { generateFixtures } from '../lib/fixtures.js';
import { notifyFavourites } from '../lib/notify.js';

export const startdivision: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('startdivision')
    .setDescription('Start a division and auto-generate the full fixture list (ADMIN / OVERSEER)')
    .addStringOption((o) => o.setName('division').setDescription('Division to start').setRequired(true))
    .addStringOption((o) => o.setName('start_date').setDescription('First gameweek date (YYYY-MM-DD)'))
    .addStringOption((o) => o.setName('kickoff_time').setDescription('Kickoff time, 24h HH:MM (default 20:00)')),

  async execute(interaction, actor) {
    requireStaff(actor);
    const division = await findDivision(interaction.options.getString('division', true));
    if (division.status === 'active') throw new Error(`**${division.name}** is already running.`);

    const dateOpt = interaction.options.getString('start_date');
    const timeOpt = interaction.options.getString('kickoff_time') ?? '20:00';
    if (dateOpt && !/^\d{4}-\d{2}-\d{2}$/.test(dateOpt)) throw new Error('`start_date` must look like `2026-09-01`.');
    if (!/^\d{2}:\d{2}$/.test(timeOpt)) throw new Error('`kickoff_time` must look like `20:00`.');

    const start = dateOpt ? new Date(`${dateOpt}T${timeOpt}:00Z`) : new Date();
    if (Number.isNaN(start.getTime())) throw new Error('Could not read that start date.');

    const result = await generateFixtures(division, start);

    const upd = await db
      .from('divisions')
      .update({ status: 'active', start_date: start.toISOString(), ended_at: null })
      .eq('id', division.id);
    if (upd.error) throw new Error(upd.error.message);

    await notifyFavourites({
      itemType: 'league',
      itemId: division.league_id,
      type: 'fixtures',
      title: `${division.name} fixtures released`,
      message: `${result.gameweeks} gameweeks • ${result.fixtures} fixtures`,
    });

    await interaction.editReply({
      embeds: [
        successEmbed('Division started', `**${division.name}** is live and the schedule is published.`).addFields(
          field('Clubs', String(result.teams)),
          field('Gameweeks', String(result.gameweeks)),
          field('Fixtures', String(result.fixtures)),
          field('First kickoff', `<t:${Math.floor(start.getTime() / 1000)}:F>`, false),
        ),
      ],
    });
  },
};

export const enddivision: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('enddivision')
    .setDescription('End a division season (ADMIN / OVERSEER)')
    .addStringOption((o) => o.setName('division').setDescription('Division to end').setRequired(true)),

  async execute(interaction, actor) {
    requireStaff(actor);
    const division = await findDivision(interaction.options.getString('division', true));

    const upd = await db
      .from('divisions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', division.id);
    if (upd.error) throw new Error(upd.error.message);

    // Close out any active loans tied to this division.
    await db
      .from('loans')
      .update({ status: 'ended', end_date: new Date().toISOString() })
      .eq('division_id', division.id)
      .eq('status', 'active');

    const { data: table } = await db
      .from('standings')
      .select('points,goal_difference,teams(name)')
      .eq('division_id', division.id)
      .order('points', { ascending: false })
      .order('goal_difference', { ascending: false })
      .limit(3);

    const podium =
      (table ?? [])
        .map((r: never, i: number) => {
          const row = r as unknown as { points: number; teams?: { name?: string } | null };
          return `${['🥇', '🥈', '🥉'][i]} **${row.teams?.name ?? 'Unknown'}** — ${row.points} pts`;
        })
        .join('\n') || 'No completed fixtures.';

    await interaction.editReply({
      embeds: [successEmbed(`${division.name} — season complete`, podium)],
    });
  },
};
