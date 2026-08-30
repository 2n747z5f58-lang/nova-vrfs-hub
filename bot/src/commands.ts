import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
) {
  switch (interaction.commandName) {
    case "setup":
      await setupCommand(interaction);
      break;

    default:
      await interaction.reply({
        content: "That NOVA command isn't ready yet.",
        ephemeral: true,
      });
  }
}

async function setupCommand(
  interaction: ChatInputCommandInteraction,
) {
  const isAdmin = interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator,
  );

  if (!isAdmin) {
    await interaction.reply({
      content: "❌ You need Administrator permission to use `/setup`.",
      ephemeral: true,
    });

    return;
  }

  await interaction.reply({
    content:
      "🛠️ **NOVA Setup**\n\n" +
      "The league setup system is being connected to the NOVA database.\n\n" +
      "Once connected, `/setup` will configure your league, divisions, " +
      "fixture settings and Discord channels.",
    ephemeral: true,
  });
}
