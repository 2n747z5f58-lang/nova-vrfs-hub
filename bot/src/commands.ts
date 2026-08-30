import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { supabase } from "./database.js";

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

  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.editReply("❌ This command can only be used inside a server.");
    return;
  }

  const { data, error } = await supabase
    .from("guild_settings")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (error) {
    console.error("Supabase setup error:", error);

    await interaction.editReply(
      "❌ I couldn't connect to the NOVA database. Check the bot's Supabase configuration.",
    );
    return;
  }

  if (data) {
    await interaction.editReply(
      "⚠️ **NOVA is already configured for this server.**",
    );
    return;
  }

  const { error: insertError } = await supabase
    .from("guild_settings")
    .insert({
      guild_id: guildId,
    });

  if (insertError) {
    console.error("Supabase insert error:", insertError);

    await interaction.editReply(
      "❌ I couldn't save this server to NOVA.",
    );
    return;
  }

  await interaction.editReply(
    "✅ **NOVA has been connected to this server.**\n\n" +
      "The server is now registered with NOVA. " +
      "League and division configuration comes next.",
  );
}
