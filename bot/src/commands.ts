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

    case "generatefixtures":
      return generateFixtures(interaction);

    case "submitresult":
      return submitResult(interaction);

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

  const divisionName =
    interaction.options.getString(
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
    .select(
      "id,name,status,start_date,gameweek_interval_days",
    )
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

  if (division.status !== "active") {
    return interaction.editReply(
      `❌ Division **${division.name}** isn't active yet.\n\nUse \`/startdivision\` first.`,
    );
  }

  const {
    data: teams,
    error: teamsError,
  } = await supabase
    .from("teams")
    .select("id,name,division_id")
    .eq("division_id", division.id)
    .order("name");

  if (teamsError) {
    console.error(teamsError);

    return interaction.editReply(
      "❌ Couldn't load the teams.",
    );
  }

  if (!teams || teams.length < 2) {
    return interaction.editReply(
      "❌ You need at least 2 teams in the division.",
    );
  }

  const {
    data: existingFixtures,
    error: existingFixturesError,
  } = await supabase
    .from("fixtures")
    .select("id")
    .eq("division_id", division.id)
    .limit(1);

  if (existingFixturesError) {
    console.error(existingFixturesError);

    return interaction.editReply(
      "❌ Couldn't check existing fixtures.",
    );
  }

  if (
    existingFixtures &&
    existingFixtures.length > 0
  ) {
    return interaction.editReply(
      `⚠️ Fixtures already exist for **${division.name}**.`,
    );
  }

  /*
   * ROUND ROBIN
   */

  let scheduleTeams = [...teams];

  if (scheduleTeams.length % 2 !== 0) {
    scheduleTeams.push({
      id: null,
      name: "BYE",
      division_id: division.id,
    });
  }

  const totalTeams = scheduleTeams.length;
  const roundsPerLeg = totalTeams - 1;
  const matchesPerRound = totalTeams / 2;

  const rounds: {
    home: typeof scheduleTeams[number];
    away: typeof scheduleTeams[number];
  }[][] = [];

  let rotating = [...scheduleTeams];

  for (
    let round = 0;
    round < roundsPerLeg;
    round++
  ) {
    const matches: typeof rounds[number] = [];

    for (
      let i = 0;
      i < matchesPerRound;
      i++
    ) {
      const first = rotating[i];

      const second =
        rotating[totalTeams - 1 - i];

      if (
        first.id === null ||
        second.id === null
      ) {
        continue;
      }

      const home =
        round % 2 === 0
          ? first
          : second;

      const away =
        round % 2 === 0
          ? second
          : first;

      matches.push({
        home,
        away,
      });
    }

    rounds.push(matches);

    rotating = [
      rotating[0],
      rotating[totalTeams - 1],
      ...rotating.slice(
        1,
        totalTeams - 1,
      ),
    ];
  }

  const firstStart = division.start_date
    ? new Date(division.start_date)
    : new Date();

  const intervalDays =
    division.gameweek_interval_days || 3;

  let fixtureCount = 0;

  for (
    let roundIndex = 0;
    roundIndex < rounds.length * 2;
    roundIndex++
  ) {
    const firstLeg =
      roundIndex < rounds.length;

    const sourceRound =
      rounds[
        firstLeg
          ? roundIndex
          : roundIndex - rounds.length
      ];

    const gameweekNumber =
      roundIndex + 1;

    const gameweekStart =
      new Date(firstStart);

    gameweekStart.setDate(
      gameweekStart.getDate() +
        roundIndex * intervalDays,
    );

    /*
     * CREATE GAMEWEEK
     */

    const {
      data: gameweek,
      error: gameweekError,
    } = await supabase
      .from("gameweeks")
      .insert({
        division_id: division.id,
        number: gameweekNumber,
        starts_at:
          gameweekStart.toISOString(),
      })
      .select()
      .single();

    if (gameweekError || !gameweek) {
      console.error(
        `Gameweek ${gameweekNumber} error:`,
        gameweekError,
      );

      return interaction.editReply(
        `❌ Couldn't create Gameweek ${gameweekNumber}.`,
      );
    }

    /*
     * CREATE FIXTURES
     */

    for (
      let matchIndex = 0;
      matchIndex < sourceRound.length;
      matchIndex++
    ) {
      const match =
        sourceRound[matchIndex];

      let homeTeam = match.home;
      let awayTeam = match.away;

      if (!firstLeg) {
        homeTeam = match.away;
        awayTeam = match.home;
      }

      const kickoff =
        new Date(gameweekStart);

      kickoff.setHours(
        kickoff.getHours() +
          matchIndex * 2,
      );

      const { error: fixtureError } =
        await supabase
          .from("fixtures")
          .insert({
            league_id: settings.league_id,
            division_id: division.id,
            home_team_id: homeTeam.id,
            away_team_id: awayTeam.id,
            kickoff_at:
              kickoff.toISOString(),
            status: "scheduled",
            home_score: null,
            away_score: null,
            competition: "League",
            gameweek: gameweekNumber,
          });

      if (fixtureError) {
        console.error(
          "Fixture creation error:",
          fixtureError,
        );

        return interaction.editReply(
          "❌ Couldn't create a fixture.",
        );
      }

      fixtureCount++;
    }
  }

  return interaction.editReply(
    `✅ Fixtures generated for **${division.name}**!\n\n` +
      `📅 Gameweeks: **${rounds.length * 2}**\n` +
      `⚽ Fixtures: **${fixtureCount}**\n` +
      `⏱️ Gameweek interval: **${intervalDays} days**\n\n` +
      `🏠 Home & away fixtures have been created.`,
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

  await interaction.deferReply({
    ephemeral: true,
  });

  const guildId = interaction.guildId;

  if (!guildId) {
    return interaction.editReply(
      "❌ Use this inside a server.",
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

  if (!lines.length) {
    return interaction.editReply(
      "❌ Result is empty.",
    );
  }

  /*
   * SCORE LINE
   *
   * TEST 2 - 1 TEST1
   */

  const scoreMatch = lines[0].match(
    /^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+?)$/i,
  );

  if (!scoreMatch) {
    return interaction.editReply(
      "❌ First line must look like:\n`TEST 2 - 1 TEST1`",
    );
  }

  const homeName =
    scoreMatch[1].trim();

  const homeScore =
    Number(scoreMatch[2]);

  const awayScore =
    Number(scoreMatch[3]);

  const awayName =
    scoreMatch[4].trim();

  /*
   * SERVER → LEAGUE
   */

  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from("guild_settings")
    .select("league_id")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (
    settingsError ||
    !settings?.league_id
  ) {
    console.error(settingsError);

    return interaction.editReply(
      "❌ This server isn't connected to a league.",
    );
  }

  /*
   * FIND HOME TEAM
   */

  const {
    data: homeTeam,
    error: homeError,
  } = await supabase
    .from("teams")
    .select("id,name,division_id")
    .eq("league_id", settings.league_id)
    .ilike("name", homeName)
    .maybeSingle();

  /*
   * FIND AWAY TEAM
   */

  const {
    data: awayTeam,
    error: awayError,
  } = await supabase
    .from("teams")
    .select("id,name,division_id")
    .eq("league_id", settings.league_id)
    .ilike("name", awayName)
    .maybeSingle();

  if (homeError || awayError) {
    console.error(
      homeError,
      awayError,
    );

    return interaction.editReply(
      "❌ Couldn't find the teams.",
    );
  }

  if (!homeTeam) {
    return interaction.editReply(
      `❌ **${homeName}** doesn't exist in this league.`,
    );
  }

  if (!awayTeam) {
    return interaction.editReply(
      `❌ **${awayName}** doesn't exist in this league.`,
    );
  }

  /*
   * MAKE SURE THEY ARE IN THE SAME DIVISION
   */

  if (
    homeTeam.division_id !==
    awayTeam.division_id
  ) {
    return interaction.editReply(
      "❌ Those teams aren't in the same division.",
    );
  }

  /*
   * FIND THE NEXT SCHEDULED FIXTURE
   */

  const {
    data: fixtures,
    error: fixtureError,
  } = await supabase
    .from("fixtures")
    .select(
      "id,home_team_id,away_team_id,status,gameweek,kickoff_at",
    )
    .eq("league_id", settings.league_id)
    .eq("division_id", homeTeam.division_id)
    .eq("home_team_id", homeTeam.id)
    .eq("away_team_id", awayTeam.id)
    .eq("status", "scheduled")
    .order("kickoff_at", {
      ascending: true,
    })
    .limit(1);

  if (fixtureError) {
    console.error(fixtureError);

    return interaction.editReply(
      "❌ Couldn't find the fixture.",
    );
  }

  const fixture =
    fixtures?.[0];

  if (!fixture) {
    return interaction.editReply(
      `❌ No scheduled fixture found for **${homeTeam.name} vs ${awayTeam.name}**.`,
    );
  }

  /*
   * REPLAY CODES
   */

  let replay1stHalf:
    | string
    | null = null;

  let replay2ndHalf:
    | string
    | null = null;

  let replayExtraTime:
    | string
    | null = null;

  for (const line of lines) {
    const upper =
      line.toUpperCase();

    if (
      upper.startsWith("1ST HALF")
    ) {
      replay1stHalf =
        line
          .replace(
            /^1ST HALF\s*/i,
            "",
          )
          .trim();
    }

    if (
      upper.startsWith("2ND HALF")
    ) {
      replay2ndHalf =
        line
          .replace(
            /^2ND HALF\s*/i,
            "",
          )
          .trim();
    }

    if (
      upper.startsWith(
        "EXTRA TIME",
      )
    ) {
      replayExtraTime =
        line
          .replace(
            /^EXTRA TIME\s*/i,
            "",
          )
          .trim();
    }
  }

  if (
    !replay1stHalf ||
    !replay2ndHalf ||
    !replayExtraTime
  ) {
    return interaction.editReply(
      "❌ All replay codes are required.\n\n" +
        "`1ST HALF <code>`\n" +
        "`2ND HALF <code>`\n" +
        "`EXTRA TIME <code>`",
    );
  }

  /*
   * EVENT PARSING
   */

  let currentTeamId:
    | string
    | null = null;

  let section:
    | "ga"
    | "cleansheet"
    | "replays"
    | null = null;

  const events: Array<{
    fixture_id: string;
    player_id: string;
    team_id: string;
    event_type: string;
  }> = [];

  for (
    let i = 1;
    i < lines.length;
    i++
  ) {
    const line =
      lines[i];

    const upper =
      line.toUpperCase();

    /*
     * CLEAN SHEET SECTION
     */

    if (
      upper === "CLEANSHEET"
    ) {
      section = "cleansheet";
      currentTeamId = null;
      continue;
    }

    /*
     * REPLAY SECTION
     */

    if (
      upper === "REPLAY CODES"
    ) {
      section = "replays";
      currentTeamId = null;
      continue;
    }

    if (
      section === "replays"
    ) {
      continue;
    }

    /*
     * TEAM G/A HEADING
     */

    if (
      upper.endsWith("G/A")
    ) {
      const teamHeading =
        line
          .replace(
            /\s+G\/A$/i,
            "",
          )
          .trim();

      if (
        teamHeading.toLowerCase() ===
        homeTeam.name.toLowerCase()
      ) {
        currentTeamId =
          homeTeam.id;

        section = "ga";
        continue;
      }

      if (
        teamHeading.toLowerCase() ===
        awayTeam.name.toLowerCase()
      ) {
        currentTeamId =
          awayTeam.id;

        section = "ga";
        continue;
      }

      return interaction.editReply(
        `❌ Couldn't match **${teamHeading}** to either team.`,
      );
    }

    /*
     * CLEAN SHEET PLAYER
     */

    if (
      section === "cleansheet" &&
      (
        line.includes("🧱") ||
        line.includes("🧤")
      )
    ) {
      const isKeeper =
        line.includes("🧤");

      const playerName =
        line
          .replace("🧱", "")
          .replace("🧤", "")
          .trim();

      if (!playerName) {
        continue;
      }

      const {
        data: player,
      } = await supabase
        .from("players")
        .select(
          "id,username,display_name,team_id",
        )
        .or(
          `username.ilike.${playerName},display_name.ilike.${playerName}`,
        )
        .maybeSingle();

      if (!player) {
        return interaction.editReply(
          `❌ Couldn't find player **${playerName}**.`,
        );
      }

      if (
        player.team_id &&
        player.team_id !==
          homeTeam.id &&
        player.team_id !==
          awayTeam.id
      ) {
        return interaction.editReply(
          `❌ **${playerName}** isn't registered to either team.`,
        );
      }

      events.push({
        fixture_id:
          fixture.id,
        player_id:
          player.id,
        team_id:
          player.team_id ??
          homeTeam.id,
        event_type:
          isKeeper
            ? "clean_sheet_keeper"
            : "clean_sheet",
      });

      continue;
    }

    /*
     * GOAL / ASSIST PLAYER
     */

    if (
      section === "ga" &&
      (
        line.includes("⚽️") ||
        line.includes("⚽") ||
        line.includes("🅰️")
      )
    ) {
      const isGoal =
        line.includes("⚽️") ||
        line.includes("⚽");

      const playerName =
        line
          .replace("⚽️", "")
          .replace("⚽", "")
          .replace("🅰️", "")
          .trim();

      if (
        !playerName ||
        !currentTeamId
      ) {
        continue;
      }

      const {
        data: player,
      } = await supabase
        .from("players")
        .select(
          "id,username,display_name,team_id",
        )
        .or(
          `username.ilike.${playerName},display_name.ilike.${playerName}`,
        )
        .maybeSingle();

      if (!player) {
        return interaction.editReply(
          `❌ Couldn't find player **${playerName}**.`,
        );
      }

      if (
        player.team_id &&
        player.team_id !==
          currentTeamId
      ) {
        return interaction.editReply(
          `❌ **${playerName}** isn't registered to the team listed above.`,
        );
      }

      events.push({
        fixture_id:
          fixture.id,
        player_id:
          player.id,
        team_id:
          currentTeamId,
        event_type:
          isGoal
            ? "goal"
            : "assist",
      });
    }
  }

  /*
   * SCORE VALIDATION
   */

  const goalEvents =
    events.filter(
      (event) =>
        event.event_type ===
        "goal",
    );

  const homeGoals =
    goalEvents.filter(
      (event) =>
        event.team_id ===
        homeTeam.id,
    ).length;

  const awayGoals =
    goalEvents.filter(
      (event) =>
        event.team_id ===
        awayTeam.id,
    ).length;

  if (
    homeGoals !== homeScore ||
    awayGoals !== awayScore
  ) {
    return interaction.editReply(
      `❌ Goal mismatch.\n\n` +
        `Score says **${homeTeam.name} ${homeScore} - ${awayScore} ${awayTeam.name}**\n` +
        `But I found **${homeGoals}** ${homeTeam.name} goals and **${awayGoals}** ${awayTeam.name} goals.`,
    );
  }

  /*
   * SAVE FIXTURE
   */

  const {
    error: updateError,
  } = await supabase
    .from("fixtures")
    .update({
      home_score:
        homeScore,
      away_score:
        awayScore,
      status:
        "completed",
      replay_1st_half:
        replay1stHalf,
      replay_2nd_half:
        replay2ndHalf,
      replay_extra_time:
        replayExtraTime,
    })
    .eq(
      "id",
      fixture.id,
    );

  if (updateError) {
    console.error(
      updateError,
    );

    return interaction.editReply(
      "❌ Couldn't save the result.",
    );
  }

  /*
   * SAVE MATCH EVENTS
   */

  if (events.length > 0) {
    const {
      error: eventsError,
    } = await supabase
      .from("match_events")
      .insert(events);

    if (eventsError) {
      console.error(
        eventsError,
      );

      await supabase
        .from("fixtures")
        .update({
          home_score:
            null,
          away_score:
            null,
          status:
            "scheduled",
          replay_1st_half:
            null,
          replay_2nd_half:
            null,
          replay_extra_time:
            null,
        })
        .eq(
          "id",
          fixture.id,
        );

      return interaction.editReply(
        "❌ Result couldn't be saved because the player events failed.",
      );
    }
  }

  /*
   * SUCCESS
   */

  return interaction.editReply(
    `✅ **${homeTeam.name} ${homeScore} - ${awayScore} ${awayTeam.name}** submitted!\n\n` +
      `📅 Gameweek: **${fixture.gameweek ?? "N/A"}**\n` +
      `⚽ Goals/assists: **${
        events.filter(
          (event) =>
            event.event_type ===
              "goal" ||
            event.event_type ===
              "assist",
        ).length
      }**\n` +
      `🧱 Clean sheet events: **${
        events.filter(
          (event) =>
            event.event_type ===
              "clean_sheet" ||
            event.event_type ===
              "clean_sheet_keeper",
        ).length
      }**\n` +
      `🎥 Replay codes saved: **3/3**`,
  );
}

/* =========================
   SIMPLE COMMANDS
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
        .setDescription(
          "League name",
        )
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("division1")
        .setDescription(
          "Division 1",
        )
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("division2")
        .setDescription(
          "Division 2",
        )
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("division3")
        .setDescription(
          "Division 3",
        )
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
        .setDescription(
          "Team name",
        )
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("division")
        .setDescription(
          "Division name",
        )
        .setRequired(true),
    )
    .addAttachmentOption((option) =>
      option
        .setName("logo")
        .setDescription(
          "Team logo",
        )
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
        .setDescription(
          "Division name",
        )
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("tier")
        .setDescription(
          "Division tier",
        )
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
        .setDescription(
          "Division name",
        )
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
        .setDescription(
          "Division name",
        )
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
        .setDescription(
          "Division name",
        )
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("submitresult")
    .setDescription(
      "Submit a completed match result",
    )
    .addStringOption((option) =>
      option
        .setName("result")
        .setDescription(
          "Paste the complete match result",
        )
        .setRequired(true),
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
        .setDescription(
          "League name",
        )
        .setRequired(true),
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
    Routes.applicationCommands(
      clientId,
    ),
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
