import { SlashCommandBuilder } from 'discord.js';
import type { NovaCommand } from '../lib/command.js';
import { db } from '../supabase.js';
import { findFixtureBetween, findTeam, getTeamById } from '../lib/resolve.js';
import { PermissionError, isStaff, managesTeam } from '../lib/perms.js';
import { field, novaEmbed, successEmbed } from '../lib/format.js';
import { notifyFavourites } from '../lib/notify.js';

export const submitresult: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('submitresult')
    .setDescription('Submit the score for a fixture (managers of either club, or staff)')
    .addStringOption((o) => o.setName('home').setDescription('Home team').setRequired(true))
    .addStringOption((o) => o.setName('away').setDescription('Away team').setRequired(true))
    .addIntegerOption((o) => o.setName('home_score').setDescription('Home goals').setMinValue(0).setRequired(true))
    .addIntegerOption((o) => o.setName('away_score').setDescription('Away goals').setMinValue(0).setRequired(true))
    .addStringOption((o) => o.setName('replay_code').setDescription('Replay / evidence code'))
    .addStringOption((o) => o.setName('notes').setDescription('Notes for staff')),

  async execute(interaction, actor) {
    const homeTeam = await findTeam(interaction.options.getString('home', true));
    const awayTeam = await findTeam(interaction.options.getString('away', true));
    if (homeTeam.id === awayTeam.id) throw new Error('A team cannot play itself.');

    if (!isStaff(actor) && !managesTeam(actor, homeTeam.id) && !managesTeam(actor, awayTeam.id)) {
      throw new PermissionError('Only a **MANAGER**/**CO-MANAGER** of one of the two clubs (or staff) can submit this result.');
    }

    const fixture = await findFixtureBetween(homeTeam.id, awayTeam.id);
    const flipped = fixture.home_team_id === awayTeam.id;
    const homeScore = interaction.options.getInteger('home_score', true);
    const awayScore = interaction.options.getInteger('away_score', true);
    const fixtureHome = flipped ? awayScore : homeScore;
    const fixtureAway = flipped ? homeScore : awayScore;

    const upd = await db
      .from('fixtures')
      .update({ home_score: fixtureHome, away_score: fixtureAway, status: 'completed' })
      .eq('id', fixture.id);
    if (upd.error) throw new Error(upd.error.message);

    const res = await db.from('results').insert({
      fixture_id: fixture.id,
      home_score: fixtureHome,
      away_score: fixtureAway,
      replay_code: interaction.options.getString('replay_code'),
      notes: interaction.options.getString('notes'),
      submitted_by: actor.profile?.id ?? null,
    });
    if (res.error && !res.error.message.includes('duplicate')) throw new Error(res.error.message);

    const realHome = fixture.home_team_id ? await getTeamById(fixture.home_team_id) : homeTeam;
    const realAway = fixture.away_team_id ? await getTeamById(fixture.away_team_id) : awayTeam;
    const scoreline = `**${realHome.name} ${fixtureHome} – ${fixtureAway} ${realAway.name}**`;

    for (const team of [realHome, realAway]) {
      await notifyFavourites({
        itemType: 'team',
        itemId: team.id,
        type: 'result',
        title: 'Result confirmed',
        message: `${realHome.name} ${fixtureHome}-${fixtureAway} ${realAway.name}`,
      });
    }

    const embed = successEmbed('Result submitted', scoreline).addFields(
      field('Gameweek', fixture.gameweek ? `GW ${fixture.gameweek}` : '—'),
      field('Replay code', interaction.options.getString('replay_code') ?? '—'),
      field('Submitted by', `<@${interaction.user.id}>`),
    );
    await interaction.editReply({ embeds: [embed] });
    if (!isStaff(actor)) {
      await interaction.followUp({
        embeds: [novaEmbed('Standings updated', 'League tables recalculated automatically.')],
        ephemeral: true,
      });
    }
  },
};
