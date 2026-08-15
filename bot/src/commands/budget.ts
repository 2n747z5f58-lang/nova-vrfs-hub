import { SlashCommandBuilder } from 'discord.js';
import type { NovaCommand } from '../lib/command.js';
import { db, must } from '../supabase.js';
import { findTeam, getTeamById } from '../lib/resolve.js';
import { isStaff } from '../lib/perms.js';
import { field, money, novaEmbed, successEmbed } from '../lib/format.js';
import { applyBudget } from '../lib/budget.js';

export const budget: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('budget')
    .setDescription('View a club budget, or adjust it (ADMIN / OVERSEER)')
    .addStringOption((o) => o.setName('team').setDescription('Club (defaults to your club)'))
    .addIntegerOption((o) =>
      o.setName('adjust').setDescription('Add (positive) or remove (negative) funds — staff only'),
    )
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the adjustment')),

  async execute(interaction, actor) {
    const teamOpt = interaction.options.getString('team');
    const team = teamOpt
      ? await findTeam(teamOpt)
      : actor.managedTeamIds[0]
        ? await getTeamById(actor.managedTeamIds[0])
        : (() => {
            throw new Error('You do not manage a club — pass `team`.');
          })();

    const adjust = interaction.options.getInteger('adjust');
    if (adjust !== null && adjust !== 0) {
      if (!isStaff(actor)) throw new Error('Only **ADMIN** and **OVERSEER** staff can adjust budgets.');
      const next = await applyBudget({
        team,
        amount: adjust,
        type: 'adjustment',
        description: interaction.options.getString('reason') ?? 'Staff adjustment',
        createdBy: actor.profile?.id ?? null,
      });
      await interaction.editReply({
        embeds: [
          successEmbed('Budget updated', `**${team.name}** budget adjusted.`).addFields(
            field('Change', `${adjust > 0 ? '+' : '−'}${money(Math.abs(adjust))}`),
            field('New budget', money(next)),
            field('Reason', interaction.options.getString('reason') ?? '—', false),
          ),
        ],
      });
      return;
    }

    const txs = must<
      { transaction_type: string; amount: number; description: string | null; created_at: string }[]
    >(
      await db
        .from('budget_transactions')
        .select('transaction_type,amount,description,created_at')
        .eq('team_id', team.id)
        .order('created_at', { ascending: false })
        .limit(5),
    );

    const history =
      txs
        .map(
          (t) =>
            `${Number(t.amount) >= 0 ? '🟢' : '🔴'} ${money(Math.abs(Number(t.amount)))} — ${t.description ?? t.transaction_type}`,
        )
        .join('\n') || 'No transactions yet.';

    await interaction.editReply({
      embeds: [
        novaEmbed(`${team.name} — finances`, `Available budget: **${money(Number(team.budget ?? 0))}**`).addFields(
          field('Recent activity', history, false),
        ),
      ],
    });
  },
};
