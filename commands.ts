import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
) {
  if (interaction.commandName === "setup") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "You need the Discord Administrator permission to use this.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: "NOVA setup is ready. League configuration will be connected next.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: "That NOVA command isn't implemented yet.",
    ephemeral: true,
  });
}
