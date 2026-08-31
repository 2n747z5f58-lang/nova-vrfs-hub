import {
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { supabase } from "./database.js";
import {
  generateFixtures as generateDivisionFixtures,
} from "./fixtures.js";
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
if (!token || !clientId) {
  throw new Error(
    "DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are required.",
  );
}
/* =========================
   COMMAND HANDLER
========================= */
export async function handleCommand(
  interaction: ChatInputCommandInteraction,
) {
  switch (interaction.commandName) {
    case "setup":
      return setup(interaction);
    case "addteam":
      return addTeam(interaction);
    case "makedivision":
      return makeDivision(interaction);
    case "startdivision":
      return startDivision(interaction);
    case "enddivision":
      return endDivision(interaction);
    case "generatefixtures":
      return generateFixtures(interaction);
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
/* =========================
   PERMISSIONS
========================= */
function isAdmin(
  interaction: ChatInputCommandInteraction,
) {
  return interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator,
  );
}
/* =========================
   SETUP
========================= */
async function setup(
  interaction: ChatInputCommandInteraction,
) {
  if (!isAdmin(interaction)) {
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
  const divisionNames = [
    interaction.options.getString("division1", true),
    interaction.options.getString("division2"),
    interaction.options.getString("division3"),
  ].filter(
    (value): value is string => Boolean(value),
  );
  const slug = leagueName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const {
    data: existingGuild,
    error: guildCheckError,
  } = await supabase
    .from("guild_settings")
    .select("guild_id")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (guildCheckError) {
    console.error(guildCheckError);
    return interaction.editReply(
      "❌ Couldn't check the server connection.",
    );
  }
  if (existingGuild) {
    return interaction.editReply(
      "⚠️ This Discord server is already connected to NOVA.",
    );
  }
  const {
    data: existingLeague,
    error: leagueCheckError,
  } = await supabase
    .from("leagues")
    .select("id")
    .or(`name.ilike.${leagueName},slug.eq.${slug}`)
    .maybeSingle();
  if (leagueCheckError) {
    console.error(leagueCheckError);
    return interaction.editReply(
      "❌ Couldn't check whether that league already exists.",
    );
  }
  if (existingLeague) {
    return interaction.editReply(
      `❌ A league named **${leagueName}** already exists.`,
    );
  }
  const {
    data: league,
    error: leagueError,
  } = await supabase
    .from("leagues")
    .insert({
      name: leagueName,
      slug,
      status: "setup",
    })
    .select()
    .single();
  if (leagueError || !league) {
    console.error(leagueError);
    return interaction.editReply(
      "❌ Couldn't create the league.",
    );
  }
  const {
    error: guildError,
  } = await supabase
    .from("guild_settings")
    .insert({
      guild_id: guildId,
      guild_name: interaction.guild?.name ?? null,
      league_id: league.id,
      updated_by_discord_id: interaction.user.id,
    });
  if (guildError) {
    console.error(guildError);
    await supabase
      .from("leagues")
      .delete()
      .eq("id", league.id);
    return interaction.editReply(
      "❌ League created, but the Discord server couldn't be connected.",
    );
  }
  for (let i = 0; i < divisionNames.length; i++) {
    const { error } = await supabase
      .from("divisions")
      .insert({
        league_id: league.id,
        name: divisionNames[i],
        tier: i + 1,
        status: "setup",
        gameweek_interval_days: 3,
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
      divisionNames
        .map(
          (division, index) =>
            `${["🥇", "🥈", "🥉"][index] ?? "📋"} ${division}`,
        )
        .join("\n") +
      `\n\n👑 You are now the primary Overseer.\n🌐 Manage the rest through NOVA.`,
  );
}
/* =========================
   ADD TEAM
========================= */
async function addTeam(
  interaction: ChatInputCommandInteraction,
) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content:
        "❌ You need Administrator permission to add teams.",
      ephemeral: true,
    });
  }
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.editReply(
      "❌ Use `/addteam` inside a server.",
    );
  }
  const teamName = interaction.options.getString(
    "team",
    true,
  );
  const divisionName = interaction.options.getString(
    "division",
    true,
  );
  const logo = interaction.options.getAttachment("logo");
  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from("guild_settings")
    .select("league_id")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (settingsError || !settings?.league_id) {
    console.error(settingsError);
    return interaction.editReply(
      "❌ This server isn't connected to a league.",
    );
  }
  const {
    data: division,
    error: divisionError,
  } = await supabase
    .from("divisions")
    .select("id,name,status")
    .eq("league_id", settings.league_id)
    .ilike("name", divisionName)
    .maybeSingle();
  if (divisionError) {
    console.error(divisionError);
    return interaction.editReply(
      "❌ Couldn't find that division.",
    );
  }
  if (!division) {
    return interaction.editReply(
      `❌ Division **${divisionName}** doesn't exist.`,
    );
  }
  const teamSlug = teamName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const {
    data: existingTeam,
  } = await supabase
    .from("teams")
    .select("id")
    .eq("league_id", settings.league_id)
    .or(`name.ilike.${teamName},slug.eq.${teamSlug}`)
    .maybeSingle();
  if (existingTeam) {
    return interaction.editReply(
      `❌ **${teamName}** already exists in this league.`,
    );
  }
  const { error: teamError } =
    await supabase
      .from("teams")
      .insert({
        name: teamName,
        slug: teamSlug,
        logo_url: logo?.url ?? null,
        league_id: settings.league_id,
        division_id: division.id,
        budget: 0,
      });
  if (teamError) {
    console.error(teamError);
    return interaction.editReply(
      "❌ Couldn't create the team.",
    );
  }
  return interaction.editReply(
    `✅ **${teamName}** has been added to **${divisionName}**!` +
      (logo ? "\n🖼️ Logo saved." : ""),
  );
}
/* =========================
   MAKE DIVISION
========================= */
async function makeDivision(
  interaction: ChatInputCommandInteraction,
) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content:
        "❌ You need Administrator permission.",
      ephemeral: true,
    });
  }
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.editReply(
      "❌ Use this inside a server.",
    );
  }
  const name = interaction.options.getString(
    "division",
    true,
  );
  const tier =
    interaction.options.getInteger("tier") ?? 1;
  const { data: settings } =
    await supabase
      .from("guild_settings")
      .select("league_id")
      .eq("guild_id", guildId)
      .maybeSingle();
  if (!settings?.league_id) {
    return interaction.editReply(
      "❌ This server isn't connected to a league.",
    );
  }
  const { data: existing } =
    await supabase
      .from("divisions")
      .select("id")
      .eq("league_id", settings.league_id)
      .ilike("name", name)
      .maybeSingle();
  if (existing) {
    return interaction.editReply(
      `❌ Division **${name}** already exists.`,
    );
  }
  const { error } =
    await supabase
      .from("divisions")
      .insert({
        league_id: settings.league_id,
        name,
        tier,
        status: "setup",
        gameweek_interval_days: 3,
      });
  if (error) {
    console.error(error);
    return interaction.editReply(
      "❌ Couldn't create the division.",
    );
  }
  return interaction.editReply(
    `✅ **${name}** has been created as Tier ${tier}.`,
  );
}
/* =========================
   START DIVISION
========================= */
async function startDivision(
  interaction: ChatInputCommandInteraction,
) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content:
        "❌ You need Administrator permission.",
      ephemeral: true,
    });
  }
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.editReply(
      "❌ Use this inside a server.",
    );
  }
  const name = interaction.options.getString(
    "division",
    true,
  );
  const { data: settings } =
    await supabase
      .from("guild_settings")
      .select("league_id")
      .eq("guild_id", guildId)
      .maybeSingle();
  if (!settings?.league_id) {
    return interaction.editReply(
      "❌ This server isn't connected to a league.",
    );
  }
  const { data: division } =
    await supabase
      .from("divisions")
      .select("id,name,status")
      .eq("league_id", settings.league_id)
      .ilike("name", name)
      .maybeSingle();
  if (!division) {
    return interaction.editReply(
      `❌ Division **${name}** doesn't exist.`,
    );
  }
  const { error } =
    await supabase
      .from("divisions")
      .update({
        status: "active",
        start_date: new Date().toISOString(),
        ended_at: null,
      })
      .eq("id", division.id);
  if (error) {
    console.error(error);
    return interaction.editReply(
      "❌ Couldn't start the division.",
    );
  }
  return interaction.editReply(
    `🟢 **${name}** has officially started!`,
  );
}
/* =========================
   END DIVISION
========================= */
async function endDivision(
  interaction: ChatInputCommandInteraction,
) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content:
        "❌ You need Administrator permission.",
      ephemeral: true,
    });
  }
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.editReply(
      "❌ Use this inside a server.",
    );
  }
  const name = interaction.options.getString(
    "division",
    true,
  );
  const { data: settings } =
    await supabase
      .from("guild_settings")
      .select("league_id")
      .eq("guild_id", guildId)
      .maybeSingle();
  if (!settings?.league_id) {
    return interaction.editReply(
      "❌ This server isn't connected to a league.",
    );
  }
  const { data: division } =
    await supabase
      .from("divisions")
      .select("id,name")
      .eq("league_id", settings.league_id)
      .ilike("name", name)
      .maybeSingle();
  if (!division) {
    return interaction.editReply(
      `❌ Division **${name}** doesn't exist.`,
    );
  }
  const { error } =
    await supabase
      .from("divisions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", division.id);
  if (error) {
    console.error(error);
    return interaction.editReply(
      "❌ Couldn't end the division.",
    );
  }
  return interaction.editReply(
    `🔴 **${name}** has ended.`,
  );
}
/* =========================
   GENERATE FIXTURES
========================= */
async function generateFixtures(
  interaction: ChatInputCommandInteraction,
) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content:
        "❌ You need Administrator permission.",
      ephemeral: true,
    });
  }
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.editReply(
      "❌ Use this inside a server.",
    );
  }
  const divisionName = interaction.options.getString(
    "division",
    true,
  );
  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from("guild_settings")
    .select("league_id")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (settingsError || !settings?.league_id) {
    console.error(settingsError);
    return interaction.editReply(
      "❌ This server isn't connected to a league.",
    );
  }
  const {
    data: division,
    error: divisionError,
  } = await supabase
    .from("divisions")
    .select("id,name")
    .eq("league_id", settings.league_id)
    .ilike("name", divisionName)
    .maybeSingle();
  if (divisionError) {
    console.error(divisionError);
    return interaction.editReply(
      "❌ Couldn't find that division.",
    );
  }
  if (!division) {
    return interaction.editReply(
      `❌ Division **${divisionName}** doesn't exist.`,
    );
  }
  try {
    const result = await generateDivisionFixtures(
      division.id,
    );
    return interaction.editReply(
      `✅ Fixtures generated for **${result.divisionName}**!\n\n` +
        `📅 Gameweeks: **${result.gameweekCount}**\n` +
        `⚽ Fixtures: **${result.fixtureCount}**\n` +
        `⏱️ Gameweek interval: **${result.intervalDays} days**\n\n` +
        `🏠 Home & away fixtures have been created.`,
    );
  } catch (error) {
    console.error(
      "Fixture generation error:",
      error,
    );
    return interaction.editReply(
      `❌ ${
        error instanceof Error
          ? error.message
          : "Couldn't generate fixtures."
      }`,
    );
  }
}
/* =========================
   SIMPLE
========================= */
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
/* =========================
   SLASH COMMANDS
========================= */
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
        .setDescription("Division 2")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("division3")
        .setDescription("Division 3")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("addteam")
    .setDescription(
      "Add a team to your league",
    )
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
        .setDescription("Team logo")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("makedivision")
    .setDescription("Create a division")
    .addStringOption((option) =>
      option
        .setName("division")
        .setDescription("Division name")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("tier")
        .setDescription("Division tier")
        .setMinValue(1)
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("startdivision")
    .setDescription("Start a division")
    .addStringOption((option) =>
      option
        .setName("division")
        .setDescription("Division name")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("enddivision")
    .setDescription("End a division")
    .addStringOption((option) =>
      option
        .setName("division")
        .setDescription("Division name")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("generatefixtures")
    .setDescription(
      "Generate a full home and away fixture schedule",
    )
    .addStringOption((option) =>
      option
        .setName("division")
        .setDescription("Division name")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("submitresult")
    .setDescription(
      "Submit a match result",
    ),
  new SlashCommandBuilder()
    .setName("setcooverseer")
    .setDescription(
      "Add a Co-Overseer",
    ),
  new SlashCommandBuilder()
    .setName("removeoverseer")
    .setDescription(
      "Remove a Co-Overseer",
    ),
  new SlashCommandBuilder()
    .setName("transferleague")
    .setDescription(
      "Transfer league connection",
    )
    .addStringOption((option) =>
      option
        .setName("league")
        .setDescription("League name")
        .setRequired(true),
    ),
].map((command) => command.toJSON());
/* =========================
   REGISTER COMMANDS
========================= */
const rest = new REST({
  version: "10",
}).setToken(token);
try {
  console.log(
    "Registering NOVA slash commands globally...",
  );
  await rest.put(
    Routes.applicationCommands(clientId),
    {
      body: commands,
    },
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
