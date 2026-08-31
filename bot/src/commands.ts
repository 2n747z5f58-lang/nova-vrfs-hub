import {
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { supabase } from "./database.js";
import { generateFixtures } from "./fixtures.js";

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

    case "submitresult":
      return submitResult(interaction);

    case "setcooverseer":
      return setCoOverseer(interaction);

    case "removeoverseer":
      return removeOverseer(interaction);

    case "transferleague":
      return transferLeague(interaction);

    default:
      return interaction.reply({
        content: "❌ Unknown NOVA command.",
        ephemeral: true,
      });
  }
}

/* =========================
   PERMISSION HELPER
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
    console.error(
      "Guild lookup error:",
      guildCheckError,
    );

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
    console.error(
      "League lookup error:",
      leagueCheckError,
    );

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
    console.error(
      "League creation error:",
      leagueError,
    );

    return interaction.editReply(
      "❌ Couldn't create the league.",
    );
  }

  const { error: guildError } =
    await supabase
      .from("guild_settings")
      .insert({
        guild_id: guildId,
        guild_name:
          interaction.guild?.name ?? null,
        league_id: league.id,
        updated_by_discord_id:
          interaction.user.id,
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

  for (
    let i = 0;
    i < divisionNames.length;
    i++
  ) {
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
      `\n\n👑 You are now the primary Overseer.` +
      `\n🌐 Manage the rest through NOVA.`,
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

  const divisionName =
    interaction.options.getString(
      "division",
      true,
    );

  const logo =
    interaction.options.getAttachment("logo");

  const {
    data: settings,
    error: settingsError,
  } = await supabase
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
      `❌ Division **${divisionName}** doesn't exist.`,
    );
  }

  const teamSlug = teamName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const { data: existingTeam } =
    await supabase
      .from("teams")
      .select("id")
      .eq("league_id", settings.league_id)
      .or(
        `name.ilike.${teamName},slug.eq.${teamSlug}`,
      )
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
    console.error(
      "Division creation error:",
      error,
    );

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

  const {
    data: settings,
    error: settingsError,
  } = await supabase
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

  const {
    data: division,
    error: divisionError,
  } = await supabase
    .from("divisions")
    .select(
      "id,name,status,gameweek_interval_days",
    )
    .eq("league_id", settings.league_id)
    .ilike("name", name)
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
      `❌ Division **${name}** doesn't exist.`,
    );
  }

  if (division.status === "active") {
    return interaction.editReply(
      `⚠️ **${name}** is already active.`,
    );
  }

  if (division.status === "ended") {
    return interaction.editReply(
      `❌ **${name}** has already ended.`,
    );
  }

  try {
    const result = await generateFixtures(
      division.id,
      new Date(),
    );

    const {
      error: updateError,
    } = await supabase
      .from("divisions")
      .update({
        status: "active",
        start_date:
          new Date().toISOString(),
        ended_at: null,
      })
      .eq("id", division.id);

    if (updateError) {
      console.error(
        "Division activation error:",
        updateError,
      );

      return interaction.editReply(
        "❌ Fixtures were created, but the division couldn't be started.",
      );
    }

    return interaction.editReply(
      `🟢 **${name}** has officially started!\n\n` +
        `📅 ${result.gameweekCount} gameweeks created\n` +
        `⚽ ${result.fixtureCount} fixtures created\n` +
        `⏱️ Gameweek interval: ${result.intervalDays} days`,
    );
  } catch (error) {
    console.error(
      "Fixture generation error:",
      error,
    );

    return interaction.editReply(
      `❌ Couldn't start **${name}**.\n\n${
        error instanceof Error
          ? error.message
          : "Unknown error."
      }`,
    );
  }
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
        ended_at:
          new Date().toISOString(),
      })
      .eq("id", division.id);

  if (error) {
    console.error(
      "Division ending error:",
      error,
    );

    return interaction.editReply(
      "❌ Couldn't end the division.",
    );
  }

  return interaction.editReply(
    `🔴 **${name}** has ended.`,
  );
}

/* =========================
   SUBMIT RESULT
========================= */

async function submitResult(
  interaction: ChatInputCommandInteraction,
) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content:
        "❌ You need Administrator permission.",
      ephemeral: true,
    });
  }

  return interaction.reply({
    content:
      "🛠️ `/submitresult` is the next fixture feature. Fixture/team result parsing will be connected next.",
    ephemeral: true,
  });
}

/* =========================
   CO-OVERSEER
   NOVA SITE ONLY
========================= */

async function setCoOverseer(
  interaction: ChatInputCommandInteraction,
) {
  return interaction.reply({
    content:
      "🌐 Co-Overseer management is handled through the NOVA site.",
    ephemeral: true,
  });
}

/* =========================
   REMOVE OVERSEER
   NOVA SITE ONLY
========================= */

async function removeOverseer(
  interaction: ChatInputCommandInteraction,
) {
  return interaction.reply({
    content:
      "🌐 Overseer management is handled through the NOVA site.",
    ephemeral: true,
  });
}

/* =========================
   TRANSFER LEAGUE
   NOVA SITE ONLY
========================= */

async function transferLeague(
  interaction: ChatInputCommandInteraction,
) {
  return interaction.reply({
    content:
      "🌐 League transfers are handled through the NOVA site.",
    ephemeral: true,
  });
}

/* =========================
   SLASH COMMAND REGISTRATION
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
    .setName("submitresult")
    .setDescription(
      "Submit a match result",
    ),

  new SlashCommandBuilder()
    .setName("setcooverseer")
    .setDescription(
      "Manage Co-Overseer on NOVA",
    ),

  new SlashCommandBuilder()
    .setName("removeoverseer")
    .setDescription(
      "Manage Overseers on NOVA",
    ),

  new SlashCommandBuilder()
    .setName("transferleague")
    .setDescription(
      "Transfer league on NOVA",
    ),
].map((command) =>
  command.toJSON(),
);

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
