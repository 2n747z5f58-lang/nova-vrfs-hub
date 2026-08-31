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
      return siteOnly(interaction, "setcooverseer");

    case "removeoverseer":
      return siteOnly(interaction, "removeoverseer");

    case "transferleague":
      return siteOnly(interaction, "transferleague");

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
    console.error("Guild lookup error:", guildCheckError);

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
        guild_name: interaction.guild?.name ?? null,
        league_id: league.id,
        updated_by_discord_id: interaction.user.id,
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
      `\n\n👑 You are now the primary Overseer.\n` +
      `🌐 Manage the rest through NOVA.`,
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

  const logo = interaction.options.getAttachment(
    "logo",
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
    console.error(
      "Start division error:",
      error,
    );

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
    console.error(
      "End division error:",
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

  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;

  if (!guildId) {
    return interaction.editReply(
      "❌ Use `/submitresult` inside a server.",
    );
  }

  const resultText =
    interaction.options.getString(
      "result",
      true,
    );

  const lines = resultText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  /*
    Expected:

    TEAM 1 3 - 1 TEAM 2

    TEAM 1 G/A
    PLAYER ⚽️
    PLAYER 🅰️

    TEAM 2 G/A
    PLAYER ⚽️

    CLEANSHEET
    PLAYER 🧱
    PLAYER 🧤

    REPLAY CODES
    1ST HALF 123
    2ND HALF 456
    EXTRA TIME 789
  */

  const scoreIndex = lines.findIndex((line) =>
    /^\S.+\s+\d+\s*-\s*\d+\s+.+$/.test(line),
  );

  if (scoreIndex === -1) {
    return interaction.editReply(
      "❌ Couldn't read the result.\n\nUse:\n`TEAM 3 - 1 TEAM`",
    );
  }

  const scoreLine = lines[scoreIndex];

  const scoreMatch =
    scoreLine.match(
      /^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/,
    );

  if (!scoreMatch) {
    return interaction.editReply(
      "❌ Couldn't read the teams and score.",
    );
  }

  const homeTeamName =
    scoreMatch[1].trim();

  const homeScore =
    Number(scoreMatch[2]);

  const awayScore =
    Number(scoreMatch[3]);

  const awayTeamName =
    scoreMatch[4].trim();

  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from("guild_settings")
    .select("league_id")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (settingsError) {
    console.error(settingsError);

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
    data: fixtures,
    error: fixtureError,
  } =
    await supabase
      .from("fixtures")
      .select(
        "id,league_id,division_id,home_team_id,away_team_id,status,home_score,away_score",
      )
      .eq("league_id", settings.league_id)
      .neq("status", "completed");

  if (fixtureError) {
    console.error(
      "Fixture lookup error:",
      fixtureError,
    );

    return interaction.editReply(
      "❌ Couldn't find the fixture.",
    );
  }

  if (!fixtures || fixtures.length === 0) {
    return interaction.editReply(
      "❌ No unfinished fixtures were found.",
    );
  }

  const teamIds = [
    ...new Set(
      fixtures.flatMap((fixture) => [
        fixture.home_team_id,
        fixture.away_team_id,
      ]),
    ),
  ];

  const {
    data: teams,
    error: teamsError,
  } = await supabase
    .from("teams")
    .select("id,name")
    .in("id", teamIds);

  if (teamsError) {
    console.error(
      "Team lookup error:",
      teamsError,
    );

    return interaction.editReply(
      "❌ Couldn't identify the teams.",
    );
  }

  const teamMap = new Map(
    (teams ?? []).map((team) => [
      team.id,
      team.name,
    ]),
  );

  const normalise = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const fixture =
    fixtures.find((f) => {
      const home =
        teamMap.get(f.home_team_id);

      const away =
        teamMap.get(f.away_team_id);

      return (
        normalise(home ?? "") ===
          normalise(homeTeamName) &&
        normalise(away ?? "") ===
          normalise(awayTeamName)
      );
    });

  if (!fixture) {
    return interaction.editReply(
      `❌ Couldn't find:\n**${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName}**\n\nMake sure the home and away team names match NOVA.`,
    );
  }

  if (fixture.status === "completed") {
    return interaction.editReply(
      "⚠️ That fixture already has a result.",
    );
  }

  /*
    Parse replay codes.
    EXTRA TIME IS REQUIRED.
  */

  const replayIndex =
    lines.findIndex(
      (line) =>
        line.toUpperCase() ===
        "REPLAY CODES",
    );

  if (replayIndex === -1) {
    return interaction.editReply(
      "❌ You must include the **REPLAY CODES** section.",
    );
  }

  const replayLines =
    lines.slice(replayIndex + 1);

  const firstHalf =
    replayLines.find((line) =>
      /^1ST\s+HALF\s+/i.test(line),
    );

  const secondHalf =
    replayLines.find((line) =>
      /^2ND\s+HALF\s+/i.test(line),
    );

  const extraTime =
    replayLines.find((line) =>
      /^EXTRA\s+TIME\s+/i.test(line),
    );

  if (!firstHalf) {
    return interaction.editReply(
      "❌ 1ST HALF replay code is required.",
    );
  }

  if (!secondHalf) {
    return interaction.editReply(
      "❌ 2ND HALF replay code is required.",
    );
  }

  if (!extraTime) {
    return interaction.editReply(
      "❌ EXTRA TIME replay code is mandatory.",
    );
  }

  /*
    Save score.
  */

  const { error: updateError } =
    await supabase
      .from("fixtures")
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", fixture.id);

  if (updateError) {
    console.error(
      "Result update error:",
      updateError,
    );

    return interaction.editReply(
      "❌ Couldn't save the result.",
    );
  }

  /*
    Parse G/A and clean sheet names.
    These are acknowledged here so the format is
    validated and ready for the stats system.
  */

  const goalAssistIndex =
    lines.findIndex(
      (line) =>
        line.toUpperCase() ===
          `${homeTeamName.toUpperCase()} G/A` ||
        line.toUpperCase() ===
          `${awayTeamName.toUpperCase()} G/A`,
    );

  const cleanSheetIndex =
    lines.findIndex(
      (line) =>
        line.toUpperCase() ===
        "CLEANSHEET",
    );

  const replayCodeText =
    [
      firstHalf,
      secondHalf,
      extraTime,
    ]
      .map((code) => `\`${code}\``)
      .join("\n");

  console.log("Result submitted:", {
    fixtureId: fixture.id,
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    homeScore,
    awayScore,
    goalAssistSection:
      goalAssistIndex !== -1,
    cleanSheetSection:
      cleanSheetIndex !== -1,
    replayCodes: {
      firstHalf,
      secondHalf,
      extraTime,
    },
  });

  return interaction.editReply(
    `✅ **Result submitted!**\n\n` +
      `🏟️ **${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName}**\n\n` +
      `📊 Result saved to NOVA.\n` +
      `⚽ Goal/assist information received.\n` +
      `🧱 Clean sheet information received.\n\n` +
      `🎥 **Replay codes**\n` +
      replayCodeText,
  );
}

/* =========================
   SITE-ONLY COMMANDS
========================= */

async function siteOnly(
  interaction: ChatInputCommandInteraction,
  command: string,
) {
  return interaction.reply({
    content:
      `🌐 **/${command}** is managed through the NOVA website.\n\n` +
      `Use the NOVA panel to manage league ownership and Overseers.`,
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
    .setDescription(
      "Create a division",
    )
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
    .setDescription(
      "Start a division",
    )
    .addStringOption((option) =>
      option
        .setName("division")
        .setDescription("Division name")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("enddivision")
    .setDescription(
      "End a division",
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
      "Submit a complete match result",
    )
    .addStringOption((option) =>
      option
        .setName("result")
        .setDescription(
          "Paste the complete result, including G/A, clean sheet and replay codes",
        )
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("setcooverseer")
    .setDescription(
      "Managed through the NOVA website",
    ),

  new SlashCommandBuilder()
    .setName("removeoverseer")
    .setDescription(
      "Managed through the NOVA website",
    ),

  new SlashCommandBuilder()
    .setName("transferleague")
    .setDescription(
      "Managed through the NOVA website",
    ),
].map((command) =>
  command.toJSON(),
);

/* =========================
   REGISTER COMMANDS
========================= */

const rest =
  new REST({ version: "10" }).setToken(
    token,
  );

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
