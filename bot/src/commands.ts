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
      return setup(interaction);

    case "addteam":
      return simple(interaction, "addteam");

    case "makedivision":
      return simple(interaction, "makedivision");

    case "startdivision":
      return simple(interaction, "startdivision");

    case "enddivision":
      return simple(interaction, "enddivision");

    case "submitresult":
      return simple(interaction, "submitresult");

    case "setcooverseer":
      return simple(interaction, "setcooverseer");

    case "removeoverseer":
      return simple(interaction, "removeoverseer");

    case "transferleague":
      return simple(interaction, "transferleague");

    default:
      return interaction.reply({
        content: "❌ Unknown NOVA command.",
        ephemeral: true,
      });
  }
}

async function setup(interaction: ChatInputCommandInteraction) {
  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator,
    )
  ) {
    return interaction.reply({
      content: "❌ You need Administrator permission to use `/setup`.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;

  if (!guildId) {
    return interaction.editReply(
      "❌ `/setup` can only be used inside a server.",
    );
  }

  const leagueName = interaction.options.getString("league", true);
  const division1 = interaction.options.getString("division1", true);
  const division2 = interaction.options.getString("division2");
  const division3 = interaction.options.getString("division3");

  const slug = leagueName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const divisions = [
    division1,
    division2,
    division3,
  ].filter((division): division is string => Boolean(division));

  const { data: existing, error: existingError } = await supabase
    .from("guild_settings")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (existingError) {
    console.error("Guild lookup error:", existingError);
    return interaction.editReply(
      "❌ Couldn't check NOVA's database.",
    );
  }

  if (existing) {
    return interaction.editReply(
      "⚠️ This Discord server is already connected to NOVA.",
    );
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: leagueName,
      slug,
    })
    .select()
    .single();

  if (leagueError) {
    console.error("League creation error:", leagueError);
    return interaction.editReply(
      "❌ The league couldn't be created.",
    );
  }

  const { error: guildError } = await supabase
    .from("guild_settings")
    .insert({
      guild_id: guildId,
      league_id: league.id,
    });

  if (guildError) {
    console.error("Guild connection error:", guildError);

    await supabase
      .from("leagues")
      .delete()
      .eq("id", league.id);

    return interaction.editReply(
      "❌ League created, but the Discord server couldn't be connected.",
    );
  }

  for (let i = 0; i < divisions.length; i++) {
    const { error } = await supabase
      .from("divisions")
      .insert({
        league_id: league.id,
        name: divisions[i],
      });

    if (error) {
      console.error(`Division ${i + 1} creation error:`, error);
    }
  }

  await interaction.editReply(
    `✅ **${leagueName}** has been created.\n\n` +
      `🥇 Division 1: ${division1}\n` +
      (division2 ? `🥈 Division 2: ${division2}\n` : "") +
      (division3 ? `🥉 Division 3: ${division3}\n` : "") +
      `\n👑 You are now the primary Overseer for this league.\n` +
      `🌐 Manage the rest through NOVA.`,
  );
}

async function simple(
  interaction: ChatInputCommandInteraction,
  command: string,
) {
  await interaction.reply({
    content:
      `🛠️ **/${command}** is registered and ready to be connected to NOVA's league permissions.`,
    ephemeral: true,
  });
}
