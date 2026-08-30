import {
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { supabase } from "./database.js";
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
if (!token || !clientId) {
  throw new Error(
    "DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are required.",
  );
}
export async function handleCommand(
  interaction: ChatInputCommandInteraction,
) {
  switch (interaction.commandName) {
    case "setup":
      return setup(interaction);
    case "addteam":
      return addTeam(interaction);
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
async function setup(
  interaction: ChatInputCommandInteraction,
) {
  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator,
    )
  ) {
    return interaction.reply({
      content:
        "❌ You need Administrator permission to use `/setup`.",
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
  const leagueName = interaction.options.getString(
    "league",
    true,
  );
  const division1 = interaction.options.getString(
    "division1",
    true,
  );
  const division2 = interaction.options.getString(
    "division2",
  );
  const division3 = interaction.options.getString(
    "division3",
  );
  const slug = leagueName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const divisions = [
    division1,
    division2,
    division3,
  ].filter(
    (division): division is string =>
      Boolean(division),
  );
  const { data: existing, error: existingError } =
    await supabase
      .from("guild_settings")
      .select("*")
      .eq("guild_id", guildId)
      .maybeSingle();
  if (existingError) {
    console.error(
      "Guild lookup error:",
      existingError,
    );
    return interaction.editReply(
      "❌ Couldn't check NOVA's database.",
    );
  }
  if (existing) {
    return interaction.editReply(
      "⚠️ This Discord server is already connected to NOVA.",
    );
  }
  const { data: league, error: leagueError } =
    await supabase
      .from("leagues")
      .insert({
        name: leagueName,
        slug,
      })
      .select()
      .single();
  if (leagueError || !league) {
    console.error(
      "League creation error:",
      leagueError,
    );
    return interaction.editReply(
      "❌ The league couldn't be created.",
    );
  }
  const { error: guildError } =
    await supabase
      .from("guild_settings")
      .insert({
        guild_id: guildId,
        league_id: league.id,
      });
  if (guildError) {
    console.error(
      "Guild connection error:",
      guildError,
    );
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
      console.error(
        `Division ${i + 1} creation error:`,
        error,
      );
    }
  }
  return interaction.editReply(
    `✅ **${leagueName}** has been created.\n\n` +
      `🥇 Division 1: ${division1}\n` +
      (division2
        ? `🥈 Division 2: ${division2}\n`
        : "") +
      (division3
        ? `🥉 Division 3: ${division3}\n`
        : "") +
      `\n👑 You are now the primary Overseer for this league.\n` +
      `🌐 Manage the rest through NOVA.`,
  );
}
async function addTeam(
  interaction: ChatInputCommandInteraction,
) {
  if (!interaction.guildId) {
    return interaction.reply({
      content: "❌ Use `/addteam` inside a server.",
      ephemeral: true,
    });
  }
  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator,
    )
  ) {
    return interaction.reply({
      content:
        "❌ You need Administrator permission to add teams.",
      ephemeral: true,
    });
  }
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  const teamName = interaction.options.getString(
    "team",
    true,
  );
  const divisionName = interaction.options.getString(
    "division",
    true,
  );
  const logo = interaction.options.getAttachment(
    "logo",
  );
  const { data: settings, error: settingsError } =
    await supabase
      .from("guild_settings")
      .select("league_id")
      .eq("guild_id", guildId)
      .maybeSingle();
  if (settingsError) {
    console.error(
      "Settings lookup error:",
      settingsError,
    );
    return interaction.editReply(
      "❌ Couldn't check the server connection.",
    );
  }
  if (!settings?.league_id) {
    return interaction.editReply(
      "❌ This server isn't connected to a league.",
    );
  }
  const { data: division, error: divisionError } =
    await supabase
      .from("divisions")
      .select("id")
      .eq("league_id", settings.league_id)
      .ilike("name", divisionName)
      .maybeSingle();
  if (divisionError) {
    console.error(
      "Division lookup error:",
      divisionError,
    );
    return interaction.editReply(
      "❌ Couldn't find that division.",
    );
  }
  if (!division) {
    return interaction.editReply(
      `❌ Division **${divisionName}** doesn't exist in this league.`,
    );
  }
  const { data: existingTeam, error: teamLookupError } =
    await supabase
      .from("teams")
      .select("id")
      .eq("name", teamName)
      .maybeSingle();
  if (teamLookupError) {
    console.error(
      "Team lookup error:",
      teamLookupError,
    );
    return interaction.editReply(
      "❌ Couldn't check whether that team already exists.",
    );
  }
  if (existingTeam) {
    return interaction.editReply(
      `❌ **${teamName}** already exists.`,
    );
  }
  const { error: teamError } =
    await supabase
      .from("teams")
      .insert({
        name: teamName,
        division_id: division.id,
        logo_url: logo?.url ?? null,
      });
  if (teamError) {
    console.error(
      "Team creation error:",
      teamError,
    );
    return interaction.editReply(
      "❌ Couldn't create the team.",
    );
  }
  return interaction.editReply(
    `✅ **${teamName}** has been added to **${divisionName}**!` +
      (logo ? "\n🖼️ Logo saved." : ""),
  );
}
async function simple(
  interaction: ChatInputCommandInteraction,
  command: string,
) {
  return interaction.reply({
    content:
      `🛠️ **/${command}** is registered and ready to be connected to NOVA.`,
    ephemeral: true,
  });
}
const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription(
      "Create and connect a NOVA league",
    )
    .addStringOption((option) =>
      option
        .setName("league")
        .setDescription("League name")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("division1")
        .setDescription("Division 1")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("division2")
        .setDescription("Optional Division 2")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("division3")
        .setDescription("Optional Division 3")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("addteam")
    .setDescription("Add a team to your league")
    .addStringOption((option) =>
      option
        .setName("team")
        .setDescription("Team name")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("division")
        .setDescription("Division name")
        .setRequired(true),
    )
    .addAttachmentOption((option) =>
      option
        .setName("logo")
        .setDescription("Team logo image")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("makedivision")
    .setDescription("Create a division"),
  new SlashCommandBuilder()
    .setName("startdivision")
    .setDescription("Start a division"),
  new SlashCommandBuilder()
    .setName("enddivision")
    .setDescription("End a division"),
  new SlashCommandBuilder()
    .setName("submitresult")
    .setDescription("Submit a match result"),
  new SlashCommandBuilder()
    .setName("setcooverseer")
    .setDescription("Add a Co-Overseer"),
  new SlashCommandBuilder()
    .setName("removeoverseer")
    .setDescription("Remove a Co-Overseer"),
  new SlashCommandBuilder()
    .setName("transferleague")
    .setDescription("Transfer league ownership"),
].map((command) => command.toJSON());
const rest = new REST({ version: "10" }).setToken(token);
try {
  console.log(
    "Registering NOVA slash commands globally...",
  );
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: commands },
  );
  console.log(
    "✅ NOVA slash commands registered successfully.",
  );
} catch (error) {
  console.error(
    "❌ Failed to register NOVA slash commands:",
    error,
  );
  process.exit(1);
}
