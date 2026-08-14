import { SlashCommandBuilder } from 'discord.js';
import type { NovaCommand } from '../lib/command.js';
import { db, must } from '../supabase.js';
import { findDivision, findLeague, slugify } from '../lib/resolve.js';
import { requireStaff } from '../lib/perms.js';
import { field, money, successEmbed } from '../lib/format.js';

export const addteam: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('addteam')
    .setDescription('Create a club (ADMIN / OVERSEER only)')
    .addStringOption((o) => o.setName('name').setDescription('Club name').setRequired(true))
    .addStringOption((o) => o.setName('division').setDescription('Division to place the club in'))
    .addUserOption((o) => o.setName('manager').setDescription('Discord user to set as MANAGER'))
    .addIntegerOption((o) => o.setName('budget').setDescription('Starting budget').setMinValue(0))
    .addStringOption((o) => o.setName('logo_url').setDescription('Club badge URL')),

  async execute(interaction, actor) {
    requireStaff(actor);
    const name = interaction.options.getString('name', true).trim();
    const divisionName = interaction.options.getString('division');
    const division = divisionName ? await findDivision(divisionName) : null;
    const league = division ? { id: division.league_id, name: '' } : await findLeague();

    const managerUser = interaction.options.getUser('manager');
    let managerId: string | null = null;
    if (managerUser) {
      const { data } = await db.from('profiles').select('id').eq('discord_id', managerUser.id).maybeSingle();
      if (!data) throw new Error(`${managerUser} must sign in to the NOVA website once before being set as manager.`);
      managerId = data.id as string;
    }

    const budget = interaction.options.getInteger('budget') ?? 0;
    const team = must<{ id: string; name: string; slug: string }>(
      (await db
        .from('teams')
        .insert({
          name,
          slug: slugify(name),
          league_id: league.id,
          division_id: division?.id ?? null,
          budget,
          manager_id: managerId,
          logo_url: interaction.options.getString('logo_url'),
        })
        .select('id,name,slug')
        .single()) as never,
    );

    if (managerId) {
      await db.from('team_staff').insert({ team_id: team.id, user_id: managerId, role: 'manager' });
      await db.from('user_roles').insert({ user_id: managerId, role: 'manager' });
    }

    await interaction.editReply({
      embeds: [
        successEmbed('Club created', `**${team.name}** is now registered in NOVA.`).addFields(
          field('Division', division?.name ?? 'Unassigned'),
          field('Budget', money(budget)),
          field('Manager', managerUser ? `${managerUser}` : 'None yet', false),
        ),
      ],
    });
  },
};
