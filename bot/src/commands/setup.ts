import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { NovaCommand } from '../lib/command.js';
import { getGuildSettings, requireDiscordAdministrator, setupPanel } from '../lib/guild-settings.js';

export const setup: NovaCommand = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Open the NOVA setup panel (Discord Administrators only)')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  ephemeral: true,

  async execute(interaction) {
    requireDiscordAdministrator(interaction);
    const guildId = interaction.guildId!;
    const settings = await getGuildSettings(guildId);
    await interaction.editReply(setupPanel(interaction.guild?.name ?? guildId, settings));
  },
};
