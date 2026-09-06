import {
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Message,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  User,
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

    case "sign":
      return signPlayer(interaction);

    case "release":
      return releasePlayer(interaction);

    case "request-release":
      return requestRelease(interaction);

    case "roster":
      return roster(interaction);

    case "transfer":
      return createTransferOffer(interaction);

    case "loan":
      return createLoanOffer(interaction);

    default:
      return interaction.reply({
        content: "❌ Unknown NOVA command.",
        ephemeral: true,
      });
  }
}

/* =========================
   BUTTON HANDLER
========================= */

export async function handleButton(
  interaction: ButtonInteraction,
) {
  const [type, action, id] =
    interaction.customId.split(":");

  if (!id) {
    return interaction.reply({
      content: "❌ Invalid NOVA action.",
      ephemeral: true,
    });
  }

  if (
    type === "transfer" ||
    type === "loan"
  ) {
    if (action === "accept") {
      return acceptOffer(interaction, id);
    }

    if (action === "reject") {
      return rejectOffer(interaction, id);
    }
  }

  if (type === "release") {
    if (action === "accept") {
      return acceptRelease(interaction, id);
    }

    if (action === "reject") {
      return rejectRelease(interaction, id);
    }
  }

  return interaction.reply({
    content: "❌ Unknown NOVA action.",
    ephemeral: true,
  });
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

function hasConfiguredRole(
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction,
  roleId: string | null | undefined,
) {
  if (!roleId) return false;

  if (!interaction.guild) return false;

  const member = interaction.member;

  if (!member || typeof member === "string") {
    return false;
  }

  return member.roles.cache.has(roleId);
}

/* =========================
   PROFILE HELPERS
========================= */

async function getProfileByDiscordId(
  discordId: string,
) {
  const { data, error } =
    await supabase
      .from("profiles")
      .select("id,username,display_name,discord_id")
      .eq("discord_id", discordId)
      .maybeSingle();

  if (error) {
    console.error(error);
  }

  return data ?? null;
}

async function getGuildSettings(
  guildId: string,
) {
  const { data, error } =
    await supabase
      .from("guild_settings")
      .select(
        "league_id,manager_role_id,co_manager_role_id",
      )
      .eq("guild_id", guildId)
      .maybeSingle();

  if (error) {
    console.error(error);
  }

  return data ?? null;
}

/* =========================
   MANAGER TEAM LOOKUP
========================= */

async function getManagedTeam(
  profileId: string,
  leagueId: string,
) {
  /*
   * Primary manager
   */

  const { data: managerTeam } =
    await supabase
      .from("teams")
      .select(
        "id,name,slug,logo_url,league_id,division_id,budget,manager_id,discord_role_id",
      )
      .eq("league_id", leagueId)
      .eq("manager_id", profileId)
      .maybeSingle();

  if (managerTeam) {
    return managerTeam;
  }

  /*
   * Co-manager / team staff
   */

  const { data: staffRows, error } =
    await supabase
      .from("team_staff")
      .select(
        "team_id,user_id,role",
      )
      .eq("user_id", profileId);

  if (error) {
    console.error(error);
    return null;
  }

  const staff =
    staffRows?.find((row) => {
      const role =
        String(row.role ?? "").toLowerCase();

      return (
        role.includes("manager") ||
        role.includes("co-manager") ||
        role.includes("comanager")
      );
    });

  if (!staff) {
    return null;
  }

  const { data: staffTeam } =
    await supabase
      .from("teams")
      .select(
        "id,name,slug,logo_url,league_id,division_id,budget,manager_id,discord_role_id",
      )
      .eq("id", staff.team_id)
      .eq("league_id", leagueId)
      .maybeSingle();

  return staffTeam ?? null;
}

/* =========================
   TEAM MEMBERSHIP
========================= */

async function addPlayerToTeam(
  playerId: string,
  teamId: string,
) {
  const { data: existing } =
    await supabase
      .from("team_members")
      .select("id,status")
      .eq("team_id", teamId)
      .eq("player_id", playerId)
      .maybeSingle();

  if (existing) {
    const { error } =
      await supabase
        .from("team_members")
        .update({
          status: "active",
          left_at: null,
        })
        .eq("id", existing.id);

    if (error) {
      console.error(error);
      return false;
    }

    return true;
  }

  const { error } =
    await supabase
      .from("team_members")
      .insert({
        team_id: teamId,
        player_id: playerId,
        role: "player",
        status: "active",
        joined_at: new Date().toISOString(),
        left_at: null,
      });

  if (error) {
    console.error(error);
    return false;
  }

  return true;
}

async function removePlayerFromTeam(
  playerId: string,
  teamId: string,
) {
  const { error } =
    await supabase
      .from("team_members")
      .update({
        status: "inactive",
        left_at: new Date().toISOString(),
      })
      .eq("team_id", teamId)
      .eq("player_id", playerId)
      .eq("status", "active");

  if (error) {
    console.error(error);
    return false;
  }

  return true;
}

/* =========================
   GET TEAM MANAGERS
========================= */

async function getTeamManagerDiscordIds(
  teamId: string,
) {
  const ids = new Set<string>();

  const { data: team } =
    await supabase
      .from("teams")
      .select("manager_id")
      .eq("id", teamId)
      .maybeSingle();

  if (team?.manager_id) {
    const { data: profile } =
      await supabase
        .from("profiles")
        .select("discord_id")
        .eq("id", team.manager_id)
        .maybeSingle();

    if (profile?.discord_id) {
      ids.add(profile.discord_id);
    }
  }

  const { data: staff } =
    await supabase
      .from("team_staff")
      .select("user_id,role")
      .eq("team_id", teamId);

  for (const member of staff ?? []) {
    const role =
      String(member.role ?? "").toLowerCase();

    if (
      !role.includes("manager") &&
      !role.includes("co-manager") &&
      !role.includes("comanager")
    ) {
      continue;
    }

    const { data: profile } =
      await supabase
        .from("profiles")
        .select("discord_id")
        .eq("id", member.user_id)
        .maybeSingle();

    if (profile?.discord_id) {
      ids.add(profile.discord_id);
    }
  }

  return [...ids];
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

  const profile =
    await getProfileByDiscordId(
      interaction.user.id,
    );

  if (!profile) {
    return interaction.editReply(
      "❌ You need to link your Discord account to NOVA before running `/setup`.",
    );
  }

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
    console.error(guildError);

    await supabase
      .from("leagues")
      .delete()
      .eq("id", league.id);

    return interaction.editReply(
      "❌ League created, but the Discord server couldn't be connected.",
    );
  }

  const { error: memberError } =
    await supabase
      .from("league_members")
      .insert({
        league_id: league.id,
        user_id: profile.id,
        role: "overseer",
      });

  if (memberError) {
    console.error(memberError);

    await supabase
      .from("guild_settings")
      .delete()
      .eq("guild_id", guildId);

    await supabase
      .from("leagues")
      .delete()
      .eq("id", league.id);

    return interaction.editReply(
      "❌ The league was created, but your Overseer account couldn't be assigned.",
    );
  }

  for (
    let i = 0;
    i < divisionNames.length;
    i++
  ) {
    const { error } =
      await supabase
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

  const teamRole =
    interaction.options.getRole("team", true);

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

  const teamName = teamRole.name;

  const teamSlug = teamName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const {
    data: existingTeam,
    error: existingTeamError,
  } = await supabase
    .from("teams")
    .select("id")
    .eq("league_id", settings.league_id)
    .or(
      `name.ilike.${teamName},slug.eq.${teamSlug},discord_role_id.eq.${teamRole.id}`,
    )
    .maybeSingle();

  if (existingTeamError) {
    console.error(existingTeamError);

    return interaction.editReply(
      "❌ Couldn't check whether that team already exists.",
    );
  }

  if (existingTeam) {
    return interaction.editReply(
      `❌ **${teamName}** is already registered in this league.`,
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
        discord_role_id: teamRole.id,
      });

  if (teamError) {
    console.error(teamError);

    return interaction.editReply(
      "❌ Couldn't create the team.",
    );
  }

  return interaction.editReply(
    `✅ **${teamName}** has been added to **${divisionName}**!\n\n` +
      `🎭 Discord role: <@&${teamRole.id}>` +
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
      "❌ Use `/submitresult` inside a server.",
    );
  }

  const channel = interaction.channel;

  if (!channel || !("messages" in channel)) {
    return interaction.editReply(
      "❌ I couldn't access this channel.",
    );
  }

  let recentMessages;

  try {
    recentMessages =
      await channel.messages.fetch({
        limit: 50,
      });
  } catch (error) {
    console.error(
      "Recent message fetch error:",
      error,
    );

    return interaction.editReply(
      "❌ I couldn't read the recent messages.",
    );
  }

  const candidateMessages =
    [...recentMessages.values()]
      .filter(
        (message): message is Message =>
          !message.author.bot &&
          message.guildId === guildId &&
          message.content.trim().length > 0,
      )
      .sort(
        (a, b) =>
          b.createdTimestamp -
          a.createdTimestamp,
      );

  let resultMessage: Message | null = null;

  for (const message of candidateMessages) {
    const content =
      message.content.trim();

    const scoreMatch = content.match(
      /<@&(\d+)>\s+(\d+)\s*-\s*(\d+)\s+<@&(\d+)>/i,
    );

    if (!scoreMatch) continue;

    const hasReplaySection =
      /^replay codes$/im.test(content);

    if (!hasReplaySection) continue;

    const hasFirstHalf =
      /^1ST HALF\s+\S+/im.test(content);

    const hasSecondHalf =
      /^2ND HALF\s+\S+/im.test(content);

    const hasExtraTime =
      /^EXTRA TIME\s+\S+/im.test(content);

    if (
      !hasFirstHalf ||
      !hasSecondHalf ||
      !hasExtraTime
    ) {
      continue;
    }

    resultMessage = message;
    break;
  }

  if (!resultMessage) {
    return interaction.editReply(
      "❌ I couldn't find a completed result message nearby.\n\n" +
        "Make sure the result message contains:\n" +
        "`@HOME 2 - 0 @AWAY`\n" +
        "`Replay Codes`\n" +
        "`1ST HALF <code>`\n" +
        "`2ND HALF <code>`\n" +
        "`EXTRA TIME <code>`",
    );
  }

  const content =
    resultMessage.content.trim();

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const roleMentions =
    [...resultMessage.mentions.roles.values()];

  if (roleMentions.length < 2) {
    return interaction.editReply(
      "❌ The result message must mention both team roles.",
    );
  }

  const scoreMatch = content.match(
    /<@&(\d+)>\s+(\d+)\s*-\s*(\d+)\s+<@&(\d+)>/i,
  );

  if (!scoreMatch) {
    return interaction.editReply(
      "❌ I couldn't read the score.\n\nUse:\n`@HOME 0 - 0 @AWAY`",
    );
  }

  const homeRoleId = scoreMatch[1];
  const homeScore = Number(scoreMatch[2]);
  const awayScore = Number(scoreMatch[3]);
  const awayRoleId = scoreMatch[4];

  if (homeRoleId === awayRoleId) {
    return interaction.editReply(
      "❌ The home and away teams can't be the same.",
    );
  }

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

  const {
    data: homeTeam,
    error: homeError,
  } = await supabase
    .from("teams")
    .select(
      "id,name,division_id,discord_role_id",
    )
    .eq("league_id", settings.league_id)
    .eq("discord_role_id", homeRoleId)
    .maybeSingle();

  const {
    data: awayTeam,
    error: awayError,
  } = await supabase
    .from("teams")
    .select(
      "id,name,division_id,discord_role_id",
    )
    .eq("league_id", settings.league_id)
    .eq("discord_role_id", awayRoleId)
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
      `❌ The home Discord role <@&${homeRoleId}> isn't registered as a NOVA team.`,
    );
  }

  if (!awayTeam) {
    return interaction.editReply(
      `❌ The away Discord role <@&${awayRoleId}> isn't registered as a NOVA team.`,
    );
  }

  if (
    homeTeam.division_id !==
    awayTeam.division_id
  ) {
    return interaction.editReply(
      "❌ Those teams aren't in the same division.",
    );
  }

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

  const fixture = fixtures?.[0];

  if (!fixture) {
    return interaction.editReply(
      `❌ No scheduled fixture found for **${homeTeam.name} vs ${awayTeam.name}**.`,
    );
  }

  const events: Array<{
    fixture_id: string;
    player_id: string;
    team_id: string;
    event_type: string;
  }> = [];

  let currentTeamId:
    | string
    | null = null;

  let section:
    | "ga"
    | "cleansheet"
    | "replays"
    | null = null;

  for (
    let i = 1;
    i < lines.length;
    i++
  ) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (lower === "cleansheet") {
      section = "cleansheet";
      currentTeamId = null;
      continue;
    }

    if (lower === "replay codes") {
      section = "replays";
      currentTeamId = null;
      continue;
    }

    if (section === "replays") {
      continue;
    }

    const roleMatch =
      line.match(/^<@&(\d+)>$/);

    if (roleMatch) {
      const roleId = roleMatch[1];

      if (roleId === homeRoleId) {
        currentTeamId = homeTeam.id;
        section = "ga";
        continue;
      }

      if (roleId === awayRoleId) {
        currentTeamId = awayTeam.id;
        section = "ga";
        continue;
      }
    }

    const isGoal =
      line.includes("⚽️") ||
      line.includes("⚽");

    const isAssist =
      line.includes("🅰️");

    const isDefCS =
      line.includes("🧱");

    const isGKCS =
      line.includes("🧤");

    const isMOTM =
      line.includes("🌟");

    if (
      !isGoal &&
      !isAssist &&
      !isDefCS &&
      !isGKCS &&
      !isMOTM
    ) {
      continue;
    }

    if (!currentTeamId) {
      return interaction.editReply(
        `❌ Couldn't determine which team **${line}** belongs to.`,
      );
    }

    const playerName =
      line
        .replace("⚽️", "")
        .replace("⚽", "")
        .replace("🅰️", "")
        .replace("🧱", "")
        .replace("🧤", "")
        .replace("🌟", "")
        .trim();

    if (!playerName) continue;

    const discordMention =
      playerName.match(
        /^<@!?(\d+)>$/,
      );

    let player:
      | {
          id: string;
          username: string | null;
          display_name: string | null;
          team_id: string | null;
          discord_id: string | null;
        }
      | null = null;

    if (discordMention) {
      const {
        data,
        error,
      } = await supabase
        .from("players")
        .select(
          "id,username,display_name,team_id,discord_id",
        )
        .eq(
          "discord_id",
          discordMention[1],
        )
        .maybeSingle();

      if (error) {
        console.error(error);

        return interaction.editReply(
          "❌ Couldn't look up that player.",
        );
      }

      player = data;
    } else {
      const {
        data,
        error,
      } = await supabase
        .from("players")
        .select(
          "id,username,display_name,team_id,discord_id",
        )
        .or(
          `username.ilike.${playerName},display_name.ilike.${playerName}`,
        )
        .maybeSingle();

      if (error) {
        console.error(error);

        return interaction.editReply(
          "❌ Couldn't look up that player.",
        );
      }

      player = data;
    }

    if (!player) {
      return interaction.editReply(
        `❌ Couldn't find player **${playerName}**.`,
      );
    }

    if (
      player.team_id &&
      player.team_id !== currentTeamId
    ) {
      return interaction.editReply(
        `❌ **${playerName}** isn't registered to the team they're listed under.`,
      );
    }

    let eventType:
      | "goal"
      | "assist"
      | "clean_sheet"
      | "clean_sheet_keeper"
      | "motm";

    if (isGoal) {
      eventType = "goal";
    } else if (isAssist) {
      eventType = "assist";
    } else if (isDefCS) {
      eventType = "clean_sheet";
    } else if (isGKCS) {
      eventType =
        "clean_sheet_keeper";
    } else {
      eventType = "motm";
    }

    events.push({
      fixture_id: fixture.id,
      player_id: player.id,
      team_id: currentTeamId,
      event_type: eventType,
    });
  }

  const goalEvents =
    events.filter(
      (event) =>
        event.event_type === "goal",
    );

  const homeGoals =
    goalEvents.filter(
      (event) =>
        event.team_id === homeTeam.id,
    ).length;

  const awayGoals =
    goalEvents.filter(
      (event) =>
        event.team_id === awayTeam.id,
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
    if (/^1ST HALF\s+/i.test(line)) {
      replay1stHalf =
        line
          .replace(
            /^1ST HALF\s+/i,
            "",
          )
          .trim();
    }

    if (/^2ND HALF\s+/i.test(line)) {
      replay2ndHalf =
        line
          .replace(
            /^2ND HALF\s+/i,
            "",
          )
          .trim();
    }

    if (/^EXTRA TIME\s+/i.test(line)) {
      replayExtraTime =
        line
          .replace(
            /^EXTRA TIME\s+/i,
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

  const {
    error: updateError,
  } = await supabase
    .from("fixtures")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: "completed",
    })
    .eq("id", fixture.id);

  if (updateError) {
    console.error(
      "Fixture update error:",
      updateError,
    );

    return interaction.editReply(
      "❌ Couldn't save the result.",
    );
  }

  const {
    error: resultError,
  } = await supabase
    .from("results")
    .insert({
      fixture_id: fixture.id,
      home_score: homeScore,
      away_score: awayScore,
      replay_code:
        `1ST HALF ${replay1stHalf}\n` +
        `2ND HALF ${replay2ndHalf}\n` +
        `EXTRA TIME ${replayExtraTime}`,
      submitted_by: null,
      completed_at:
        new Date().toISOString(),
      recorded_at:
        new Date().toISOString(),
    });

  if (resultError) {
    console.error(
      "Result insert error:",
      resultError,
    );

    await supabase
      .from("fixtures")
      .update({
        home_score: null,
        away_score: null,
        status: "scheduled",
      })
      .eq("id", fixture.id);

    return interaction.editReply(
      "❌ Couldn't save the result.",
    );
  }

  if (events.length > 0) {
    const {
      error: eventsError,
    } = await supabase
      .from("match_events")
      .insert(events);

    if (eventsError) {
      console.error(
        "Match event error:",
        eventsError,
      );

      await supabase
        .from("fixtures")
        .update({
          home_score: null,
          away_score: null,
          status: "scheduled",
        })
        .eq("id", fixture.id);

      await supabase
        .from("results")
        .delete()
        .eq("fixture_id", fixture.id);

      return interaction.editReply(
        "❌ Result couldn't be saved because the player events failed.",
      );
    }
  }

  return interaction.editReply(
    `✅ **${homeTeam.name} ${homeScore} - ${awayScore} ${awayTeam.name}** submitted!\n\n` +
      `📅 Gameweek: **${fixture.gameweek ?? "N/A"}**\n` +
      `⚽ Goals: **${homeGoals + awayGoals}**\n` +
      `🅰️ Assists: **${
        events.filter(
          (event) =>
            event.event_type === "assist",
        ).length
      }**\n` +
      `🧱 DEF CS: **${
        events.filter(
          (event) =>
            event.event_type === "clean_sheet",
        ).length
      }**\n` +
      `🧤 GK CS: **${
        events.filter(
          (event) =>
            event.event_type === "clean_sheet_keeper",
        ).length
      }**\n` +
      `🌟 MOTM: **${
        events.filter(
          (event) =>
            event.event_type === "motm",
        ).length
      }**\n` +
      `🎥 Replay codes: **3/3**`,
  );
}

/* =========================
   SIGN PLAYER
========================= */

async function signPlayer(
  interaction: ChatInputCommandInteraction,
) {
  if (!interaction.guildId) {
    return interaction.reply({
      content:
        "❌ `/sign` can only be used inside a server.",
      ephemeral: true,
    });
  }

  const settings =
    await getGuildSettings(
      interaction.guildId,
    );

  if (!settings?.league_id) {
    return interaction.reply({
      content:
        "❌ This server isn't connected to a NOVA league.",
      ephemeral: true,
    });
  }

  const managerRole =
    settings.manager_role_id;

  const coManagerRole =
    settings.co_manager_role_id;

  if (
    !hasConfiguredRole(
      interaction,
      managerRole,
    ) &&
    !hasConfiguredRole(
      interaction,
      coManagerRole,
    )
  ) {
    return interaction.reply({
      content:
        "❌ You need the configured Manager or Co-Manager role.",
      ephemeral: true,
    });
  }

  const profile =
    await getProfileByDiscordId(
      interaction.user.id,
    );

  if (!profile) {
    return interaction.reply({
      content:
        "❌ Your Discord account isn't linked to NOVA.",
      ephemeral: true,
    });
  }

  const team =
    await getManagedTeam(
      profile.id,
      settings.league_id,
    );

  if (!team) {
    return interaction.reply({
      content:
        "❌ You aren't assigned as a Manager or Co-Manager of a NOVA team.",
      ephemeral: true,
    });
  }

  const playerUser =
    interaction.options.getUser(
      "player",
      true,
    );

  const { data: player } =
    await supabase
      .from("players")
      .select(
        "id,username,display_name,discord_id,team_id,loan_team_id",
      )
      .eq(
        "discord_id",
        playerUser.id,
      )
      .maybeSingle();

  if (!player) {
    return interaction.reply({
      content:
        "❌ That Discord user isn't registered as a NOVA player.",
      ephemeral: true,
    });
  }

  if (player.team_id) {
    return interaction.reply({
      content:
        `❌ **${player.display_name ?? player.username}** is already signed to a team.`,
      ephemeral: true,
    });
  }

  if (player.loan_team_id) {
    return interaction.reply({
      content:
        `❌ **${player.display_name ?? player.username}** is currently on loan.`,
      ephemeral: true,
    });
  }

  const { error: playerError } =
    await supabase
      .from("players")
      .update({
        team_id: team.id,
        loan_team_id: null,
      })
      .eq("id", player.id)
      .is("team_id", null);

  if (playerError) {
    console.error(playerError);

    return interaction.reply({
      content:
        "❌ Couldn't sign the player.",
      ephemeral: true,
    });
  }

  const added =
    await addPlayerToTeam(
      player.id,
      team.id,
    );

  if (!added) {
    await supabase
      .from("players")
      .update({
        team_id: null,
      })
      .eq("id", player.id);

    return interaction.reply({
      content:
        "❌ The player couldn't be added to the team roster.",
      ephemeral: true,
    });
  }

  const { error: signingError } =
    await supabase
      .from("signings")
      .insert({
        player_id: player.id,
        team_id: team.id,
        previous_team_id: null,
        signed_by: profile.id,
        details:
          "Signed via NOVA Discord bot.",
      });

  if (signingError) {
    console.error(signingError);
  }

  return interaction.reply({
    content:
      `✅ **${player.display_name ?? player.username}** has signed for **${team.name}**!`,
    ephemeral: false,
  });
}

/* =========================
   RELEASE PLAYER
========================= */

async function releasePlayer(
  interaction: ChatInputCommandInteraction,
) {
  if (!interaction.guildId) {
    return interaction.reply({
      content:
        "❌ `/release` can only be used inside a server.",
      ephemeral: true,
    });
  }

  const settings =
    await getGuildSettings(
      interaction.guildId,
    );

  if (!settings?.league_id) {
    return interaction.reply({
      content:
        "❌ This server isn't connected to a NOVA league.",
      ephemeral: true,
    });
  }

  if (
    !hasConfiguredRole(
      interaction,
      settings.manager_role_id,
    ) &&
    !hasConfiguredRole(
      interaction,
      settings.co_manager_role_id,
    )
  ) {
    return interaction.reply({
      content:
        "❌ You need the configured Manager or Co-Manager role.",
      ephemeral: true,
    });
  }

  const profile =
    await getProfileByDiscordId(
      interaction.user.id,
    );

  if (!profile) {
    return interaction.reply({
      content:
        "❌ Your Discord account isn't linked to NOVA.",
      ephemeral: true,
    });
  }

  const team =
    await getManagedTeam(
      profile.id,
      settings.league_id,
    );

  if (!team) {
    return interaction.reply({
      content:
        "❌ You aren't assigned to a NOVA team.",
      ephemeral: true,
    });
  }

  const playerUser =
    interaction.options.getUser(
      "player",
      true,
    );

  const { data: player } =
    await supabase
      .from("players")
      .select(
        "id,username,display_name,discord_id,team_id,loan_team_id",
      )
      .eq(
        "discord_id",
        playerUser.id,
      )
      .maybeSingle();

  if (!player) {
    return interaction.reply({
      content:
        "❌ That Discord user isn't registered as a NOVA player.",
      ephemeral: true,
    });
  }

  if (player.team_id !== team.id) {
    return interaction.reply({
      content:
        `❌ **${player.display_name ?? player.username}** isn't registered to **${team.name}**.`,
      ephemeral: true,
    });
  }

  const { error } =
    await supabase
      .from("players")
      .update({
        team_id: null,
        loan_team_id: null,
      })
      .eq("id", player.id)
      .eq("team_id", team.id);

  if (error) {
    console.error(error);

    return interaction.reply({
      content:
        "❌ Couldn't release the player.",
      ephemeral: true,
    });
  }

  await removePlayerFromTeam(
    player.id,
    team.id,
  );

  const { error: signingError } =
    await supabase
      .from("signings")
      .insert({
        player_id: player.id,
        team_id: team.id,
        previous_team_id: team.id,
        signed_by: profile.id,
        details:
          "Player released via NOVA Discord bot.",
      });

  if (signingError) {
    console.error(signingError);
  }

  return interaction.reply({
    content:
      `✅ **${player.display_name ?? player.username}** has been released from **${team.name}**.`,
  });
}

/* =========================
   REQUEST RELEASE
========================= */

async function requestRelease(
  interaction: ChatInputCommandInteraction,
) {
  if (!interaction.guildId) {
    return interaction.reply({
      content:
        "❌ `/request-release` can only be used inside a server.",
      ephemeral: true,
    });
  }

  const profile =
    await getProfileByDiscordId(
      interaction.user.id,
    );

  if (!profile) {
    return interaction.reply({
      content:
        "❌ Your Discord account isn't linked to NOVA.",
      ephemeral: true,
    });
  }

  const { data: player } =
    await supabase
      .from("players")
      .select(
        "id,username,display_name,team_id,loan_team_id",
      )
      .eq(
        "discord_id",
        interaction.user.id,
      )
      .maybeSingle();

  if (!player) {
    return interaction.reply({
      content:
        "❌ You aren't registered as a NOVA player.",
      ephemeral: true,
    });
  }

  if (!player.team_id) {
    return interaction.reply({
      content:
        "❌ You aren't currently signed to a team.",
      ephemeral: true,
    });
  }

  if (player.loan_team_id) {
    return interaction.reply({
      content:
        "❌ You are currently on loan. Ask your club to handle your release.",
      ephemeral: true,
    });
  }

  const reason =
    interaction.options.getString(
      "reason",
    );

  const {
    data: existing,
  } = await supabase
    .from("release_requests")
    .select("id,status")
    .eq("player_id", player.id)
    .eq("team_id", player.team_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return interaction.reply({
      content:
        "⚠️ You already have a pending release request.",
      ephemeral: true,
    });
  }

  const {
    data: request,
    error,
  } = await supabase
    .from("release_requests")
    .insert({
      player_id: player.id,
      team_id: player.team_id,
      requested_by: profile.id,
      reason: reason ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error || !request) {
    console.error(error);

    return interaction.reply({
      content:
        "❌ Couldn't create your release request.",
      ephemeral: true,
    });
  }

  const managerIds =
    await getTeamManagerDiscordIds(
      player.team_id,
    );

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `release:accept:${request.id}`,
          )
          .setLabel("Accept Release")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(
            `release:reject:${request.id}`,
          )
          .setLabel("Reject")
          .setStyle(ButtonStyle.Danger),
      );

  let sent = 0;

  for (const managerId of managerIds) {
    try {
      const user =
        await interaction.client.users.fetch(
          managerId,
        );

      await user.send({
        content:
          `📤 **NOVA Release Request**\n\n` +
          `👤 Player: **${player.display_name ?? player.username}**\n` +
          `🏟️ Team: **${player.team_id}**\n` +
          `📝 Reason: ${reason ?? "No reason provided."}\n\n` +
          `Choose whether to accept or reject the release request.`,
        components: [row],
      });

      sent++;
    } catch (error) {
      console.error(
        `Couldn't DM manager ${managerId}:`,
        error,
      );
    }
  }

  return interaction.reply({
    content:
      `✅ Your release request has been sent to your club's management.` +
      (sent === 0
        ? "\n\n⚠️ I couldn't DM the club management. Make sure their Discord DMs are open."
        : ""),
    ephemeral: true,
  });
}

/* =========================
   ROSTER
========================= */

async function roster(
  interaction: ChatInputCommandInteraction,
) {
  const teamRole =
    interaction.options.getRole("team");

  let teamId: string | null = null;

  if (teamRole) {
    const { data: team } =
      await supabase
        .from("teams")
        .select("id,name")
        .eq(
          "discord_role_id",
          teamRole.id,
        )
        .maybeSingle();

    if (!team) {
      return interaction.reply({
        content:
          "❌ That Discord role isn't registered as a NOVA team.",
        ephemeral: true,
      });
    }

    teamId = team.id;
  } else if (interaction.guildId) {
    const settings =
      await getGuildSettings(
        interaction.guildId,
      );

    if (settings?.league_id) {
      const { data: teams } =
        await supabase
          .from("teams")
          .select("id,name")
          .eq(
            "league_id",
            settings.league_id,
          )
          .order("name");

      if (teams && teams.length === 1) {
        teamId = teams[0].id;
      }
    }
  }

  if (!teamId) {
    return interaction.reply({
      content:
        "❌ Select a team using the `team` option.",
      ephemeral: true,
    });
  }

  const { data: team } =
    await supabase
      .from("teams")
      .select(
        "id,name,logo_url,budget",
      )
      .eq("id", teamId)
      .maybeSingle();

  if (!team) {
    return interaction.reply({
      content:
        "❌ Team not found.",
      ephemeral: true,
    });
  }

  const {
    data: players,
    error,
  } = await supabase
    .from("players")
    .select(
      "id,username,display_name,position,discord_id,loan_team_id",
    )
    .eq("team_id", team.id)
    .order("username");

  if (error) {
    console.error(error);

    return interaction.reply({
      content:
        "❌ Couldn't load the roster.",
      ephemeral: true,
    });
  }

  if (!players || players.length === 0) {
    return interaction.reply({
      content:
        `📋 **${team.name}** currently has no players registered.`,
    });
  }

  const lines = players.map(
    (player, index) => {
      const name =
        player.display_name ??
        player.username;

      const position =
        player.position
          ? ` • ${player.position}`
          : "";

      const loan =
        player.loan_team_id
          ? " • 🔄 Loan"
          : "";

      return (
        `**${index + 1}.** ${name}${position}${loan}`
      );
    },
  );

  return interaction.reply({
    content:
      `📋 **${team.name} Roster**\n\n` +
      lines.join("\n") +
      `\n\n👥 Players: **${players.length}**\n💰 Budget: **${team.budget}**`,
  });
}

/* =========================
   CREATE TRANSFER OFFER
========================= */

async function createTransferOffer(
  interaction: ChatInputCommandInteraction,
) {
  return createMarketOffer(
    interaction,
    "transfer",
  );
}

/* =========================
   CREATE LOAN OFFER
========================= */

async function createLoanOffer(
  interaction: ChatInputCommandInteraction,
) {
  return createMarketOffer(
    interaction,
    "loan",
  );
}

/* =========================
   CREATE MARKET OFFER
========================= */

async function createMarketOffer(
  interaction: ChatInputCommandInteraction,
  offerType: "transfer" | "loan",
) {
  if (!interaction.guildId) {
    return interaction.reply({
      content:
        `❌ \`/${offerType}\` can only be used inside a server.`,
      ephemeral: true,
    });
  }

  const settings =
    await getGuildSettings(
      interaction.guildId,
    );

  if (!settings?.league_id) {
    return interaction.reply({
      content:
        "❌ This server isn't connected to a NOVA league.",
      ephemeral: true,
    });
  }

  if (
    !hasConfiguredRole(
      interaction,
      settings.manager_role_id,
    ) &&
    !hasConfiguredRole(
      interaction,
      settings.co_manager_role_id,
    )
  ) {
    return interaction.reply({
      content:
        "❌ You need the configured Manager or Co-Manager role.",
      ephemeral: true,
    });
  }

  const profile =
    await getProfileByDiscordId(
      interaction.user.id,
    );

  if (!profile) {
    return interaction.reply({
      content:
        "❌ Your Discord account isn't linked to NOVA.",
      ephemeral: true,
    });
  }

  const fromTeam =
    await getManagedTeam(
      profile.id,
      settings.league_id,
    );

  if (!fromTeam) {
    return interaction.reply({
      content:
        "❌ You aren't assigned as management of a NOVA team.",
      ephemeral: true,
    });
  }

  const playerUser =
    interaction.options.getUser(
      "player",
      true,
    );

  const fee =
    interaction.options.getNumber(
      "fee",
      true,
    );

  const terms =
    interaction.options.getString(
      "terms",
    );

  if (fee < 0) {
    return interaction.reply({
      content:
        "❌ The fee cannot be negative.",
      ephemeral: true,
    });
  }

  const { data: player } =
    await supabase
      .from("players")
      .select(
        "id,username,display_name,discord_id,team_id,loan_team_id",
      )
      .eq(
        "discord_id",
        playerUser.id,
      )
      .maybeSingle();

  if (!player) {
    return interaction.reply({
      content:
        "❌ That Discord user isn't registered as a NOVA player.",
      ephemeral: true,
    });
  }

  if (!player.team_id) {
    return interaction.reply({
      content:
        "❌ That player is unsigned. Use `/sign` instead.",
      ephemeral: true,
    });
  }

  if (player.team_id === fromTeam.id) {
    return interaction.reply({
      content:
        "❌ You can't make an offer for a player already at your club.",
      ephemeral: true,
    });
  }

  if (
    offerType === "loan" &&
    player.loan_team_id
  ) {
    return interaction.reply({
      content:
        "❌ That player is already on loan.",
      ephemeral: true,
    });
  }

  if (
    offerType === "transfer" &&
    player.loan_team_id
  ) {
    return interaction.reply({
      content:
        "❌ That player is currently on loan.",
      ephemeral: true,
    });
  }

  if (
    Number(fromTeam.budget) < fee
  ) {
    return interaction.reply({
      content:
        `❌ Your team doesn't have enough budget.\n\nAvailable: **${fromTeam.budget}**\nOffer: **${fee}**`,
      ephemeral: true,
    });
  }

  const {
    data: existing,
  } = await supabase
    .from("transfer_offers")
    .select("id")
    .eq("player_id", player.id)
    .eq("to_team_id", fromTeam.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return interaction.reply({
      content:
        "⚠️ You already have a pending offer for this player.",
      ephemeral: true,
    });
  }

  const {
    data: offer,
    error,
  } = await supabase
    .from("transfer_offers")
    .insert({
      player_id: player.id,
      from_team_id: player.team_id,
      to_team_id: fromTeam.id,
      offered_by: profile.id,
      fee,
      status: "pending",
      offer_type: offerType,
      terms: terms ?? null,
    })
    .select()
    .single();

  if (error || !offer) {
    console.error(error);

    return interaction.reply({
      content:
        "❌ Couldn't create the offer.",
      ephemeral: true,
    });
  }

  const managerIds =
    await getTeamManagerDiscordIds(
      player.team_id,
    );

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `${offerType}:accept:${offer.id}`,
          )
          .setLabel(
            offerType === "loan"
              ? "Accept Loan"
              : "Accept Transfer",
          )
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(
            `${offerType}:reject:${offer.id}`,
          )
          .setLabel("Reject")
          .setStyle(ButtonStyle.Danger),
      );

  let sent = 0;

  for (const managerId of managerIds) {
    try {
      const user =
        await interaction.client.users.fetch(
          managerId,
        );

      await user.send({
        content:
          `📨 **NOVA ${offerType === "loan" ? "Loan" : "Transfer"} Offer**\n\n` +
          `👤 Player: **${player.display_name ?? player.username}**\n` +
          `🏟️ Selling club: **${player.team_id}**\n` +
          `🏟️ Interested club: **${fromTeam.name}**\n` +
          `💰 Fee: **${fee}**\n` +
          `📝 Terms: ${terms ?? "No additional terms."}\n\n` +
          `Review the offer below:`,
        components: [row],
      });

      sent++;
    } catch (error) {
      console.error(
        `Couldn't DM manager ${managerId}:`,
        error,
      );
    }
  }

  if (sent === 0) {
    await supabase
      .from("transfer_offers")
      .update({
        status: "cancelled",
      })
      .eq("id", offer.id);

    return interaction.reply({
      content:
        "❌ I couldn't DM the player's club management, so the offer was cancelled.",
      ephemeral: true,
    });
  }

  return interaction.reply({
    content:
      `✅ Your ${offerType} offer for **${player.display_name ?? player.username}** has been sent to their club management.\n\n` +
      `💰 Fee: **${fee}**` +
      (terms
        ? `\n📝 Terms: ${terms}`
        : ""),
    ephemeral: true,
  });
}

/* =========================
   CHECK OFFER AUTHORITY
========================= */

async function canRespondToOffer(
  interaction: ButtonInteraction,
  fromTeamId: string,
) {
  const profile =
    await getProfileByDiscordId(
      interaction.user.id,
    );

  if (!profile) return false;

  const { data: team } =
    await supabase
      .from("teams")
      .select(
        "id,manager_id,league_id",
      )
      .eq("id", fromTeamId)
      .maybeSingle();

  if (!team) return false;

  if (
    team.manager_id === profile.id
  ) {
    return true;
  }

  const { data: staff } =
    await supabase
      .from("team_staff")
      .select("role")
      .eq("team_id", fromTeamId)
      .eq("user_id", profile.id)
      .maybeSingle();

  if (!staff) return false;

  const role =
    String(staff.role ?? "").toLowerCase();

  return (
    role.includes("manager") ||
    role.includes("co-manager") ||
    role.includes("comanager")
  );
}

/* =========================
   ACCEPT TRANSFER / LOAN
========================= */

async function acceptOffer(
  interaction: ButtonInteraction,
  offerId: string,
) {
  const {
    data: offer,
    error,
  } = await supabase
    .from("transfer_offers")
    .select(
      "id,player_id,from_team_id,to_team_id,offered_by,fee,status,offer_type,terms",
    )
    .eq("id", offerId)
    .maybeSingle();

  if (error || !offer) {
    console.error(error);

    return interaction.reply({
      content:
        "❌ Offer not found.",
      ephemeral: true,
    });
  }

  if (offer.status !== "pending") {
    return interaction.reply({
      content:
        `⚠️ This offer has already been **${offer.status}**.`,
      ephemeral: true,
    });
  }

  if (!offer.from_team_id) {
    return interaction.reply({
      content:
        "❌ This offer doesn't have a valid selling club.",
      ephemeral: true,
    });
  }

  const authorised =
    await canRespondToOffer(
      interaction,
      offer.from_team_id,
    );

  if (!authorised) {
    return interaction.reply({
      content:
        "❌ You aren't management of the player's current club.",
      ephemeral: true,
    });
  }

  const {
    data: player,
  } = await supabase
    .from("players")
    .select(
      "id,username,display_name,team_id,loan_team_id",
    )
    .eq("id", offer.player_id)
    .maybeSingle();

  if (!player) {
    return interaction.reply({
      content:
        "❌ Player no longer exists.",
      ephemeral: true,
    });
  }

  if (
    player.team_id !==
    offer.from_team_id
  ) {
    return interaction.reply({
      content:
        "❌ The player is no longer registered to the selling club. This offer can no longer be completed.",
      ephemeral: true,
    });
  }

  const {
    data: buyer,
  } = await supabase
    .from("teams")
    .select(
      "id,name,budget,league_id,division_id",
    )
    .eq("id", offer.to_team_id)
    .maybeSingle();

  const {
    data: seller,
  } = await supabase
    .from("teams")
    .select(
      "id,name,budget,league_id,division_id",
    )
    .eq("id", offer.from_team_id)
    .maybeSingle();

  if (!buyer || !seller) {
    return interaction.reply({
      content:
        "❌ One of the clubs no longer exists.",
      ephemeral: true,
    });
  }

  if (
    Number(buyer.budget) <
    Number(offer.fee)
  ) {
    return interaction.reply({
      content:
        `❌ **${buyer.name}** no longer has enough budget to complete this offer.`,
      ephemeral: true,
    });
  }

  const profile =
    await getProfileByDiscordId(
      interaction.user.id,
    );

  if (!profile) {
    return interaction.reply({
      content:
        "❌ Your Discord account isn't linked to NOVA.",
      ephemeral: true,
    });
  }

  /*
   * LOAN
   */

  if (offer.offer_type === "loan") {
    if (player.loan_team_id) {
      return interaction.reply({
        content:
          "❌ The player is already on loan.",
        ephemeral: true,
      });
    }

    const { data: currentGameweek } =
      await supabase
        .from("gameweeks")
        .select("number")
        .eq(
          "division_id",
          seller.division_id,
        )
        .order("number", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    const startGameweek =
      currentGameweek?.number ??
      1;

    const { error: budgetError } =
      await supabase
        .from("teams")
        .update({
          budget:
            Number(buyer.budget) -
            Number(offer.fee),
        })
        .eq("id", buyer.id)
        .gte("budget", offer.fee);

    if (budgetError) {
      console.error(budgetError);

      return interaction.reply({
        content:
          "❌ Couldn't process the loan fee.",
        ephemeral: true,
      });
    }

    const { error: sellerBudgetError } =
      await supabase
        .from("teams")
        .update({
          budget:
            Number(seller.budget) +
            Number(offer.fee),
        })
        .eq("id", seller.id);

    if (sellerBudgetError) {
      console.error(
        sellerBudgetError,
      );

      await supabase
        .from("teams")
        .update({
          budget:
            Number(buyer.budget),
        })
        .eq("id", buyer.id);

      return interaction.reply({
        content:
          "❌ Couldn't credit the selling club.",
        ephemeral: true,
      });
    }

    const { error: loanError } =
      await supabase
        .from("loans")
        .insert({
          player_id: player.id,
          parent_team_id: seller.id,
          loan_team_id: buyer.id,
          division_id:
            buyer.division_id ??
            seller.division_id,
          start_gameweek:
            startGameweek,
          start_date:
            new Date().toISOString(),
          end_gameweek: null,
          end_date: null,
          status: "active",
        });

    if (loanError) {
      console.error(loanError);

      await supabase
        .from("teams")
        .update({
          budget:
            Number(buyer.budget),
        })
        .eq("id", buyer.id);

      await supabase
        .from("teams")
        .update({
          budget:
            Number(seller.budget),
        })
        .eq("id", seller.id);

      return interaction.reply({
        content:
          "❌ Couldn't create the loan.",
        ephemeral: true,
      });
    }

    const { error: playerError } =
      await supabase
        .from("players")
        .update({
          loan_team_id: buyer.id,
        })
        .eq("id", player.id)
        .eq("team_id", seller.id);

    if (playerError) {
      console.error(playerError);

      return interaction.reply({
        content:
          "❌ The loan was created but the player couldn't be updated.",
        ephemeral: true,
      });
    }

    await supabase
      .from("transfer_offers")
      .update({
        status: "accepted",
        responded_at:
          new Date().toISOString(),
        responded_by: profile.id,
      })
      .eq("id", offer.id)
      .eq("status", "pending");

    await interaction.update({
      content:
        `✅ **Loan accepted**\n\n` +
        `👤 ${player.display_name ?? player.username}\n` +
        `🏟️ ${seller.name} → ${buyer.name}\n` +
        `💰 Loan fee: **${offer.fee}**\n\n` +
        `This player is now on loan at **${buyer.name}**.`,
      components: [],
    });

    await notifyOfferCreator(
      interaction,
      offer.offered_by,
      `✅ Your loan offer for **${player.display_name ?? player.username}** was accepted by **${seller.name}**.`,
    );

    return;
  }

  /*
   * PERMANENT TRANSFER
   */

  const { error: buyerBudgetError } =
    await supabase
      .from("teams")
      .update({
        budget:
          Number(buyer.budget) -
          Number(offer.fee),
      })
      .eq("id", buyer.id)
      .gte("budget", offer.fee);

  if (buyerBudgetError) {
    console.error(
      buyerBudgetError,
    );

    return interaction.reply({
      content:
        "❌ Couldn't process the transfer fee.",
      ephemeral: true,
    });
  }

  const { error: sellerBudgetError } =
    await supabase
      .from("teams")
      .update({
        budget:
          Number(seller.budget) +
          Number(offer.fee),
      })
      .eq("id", seller.id);

  if (sellerBudgetError) {
    console.error(
      sellerBudgetError,
    );

    await supabase
      .from("teams")
      .update({
        budget:
          Number(buyer.budget),
      })
      .eq("id", buyer.id);

    return interaction.reply({
      content:
        "❌ Couldn't credit the selling club.",
      ephemeral: true,
    });
  }

  const { error: playerError } =
    await supabase
      .from("players")
      .update({
        team_id: buyer.id,
        loan_team_id: null,
      })
      .eq("id", player.id)
      .eq("team_id", seller.id);

  if (playerError) {
    console.error(playerError);

    return interaction.reply({
      content:
        "❌ Couldn't move the player to the new club.",
      ephemeral: true,
    });
  }

  await removePlayerFromTeam(
    player.id,
    seller.id,
  );

  await addPlayerToTeam(
    player.id,
    buyer.id,
  );

  const { error: transferError } =
    await supabase
      .from("transfers")
      .insert({
        player_id: player.id,
        from_team_id: seller.id,
        to_team_id: buyer.id,
        transfer_date:
          new Date()
            .toISOString()
            .slice(0, 10),
        details:
          offer.terms ??
          "Transfer completed via NOVA Discord bot.",
        fee: offer.fee,
        status: "completed",
        completed_at:
          new Date().toISOString(),
      });

  if (transferError) {
    console.error(
      transferError,
    );
  }

  const { error: signingError } =
    await supabase
      .from("signings")
      .insert({
        player_id: player.id,
        team_id: buyer.id,
        previous_team_id: seller.id,
        signed_by: profile.id,
        details:
          offer.terms ??
          "Transfer completed via NOVA Discord bot.",
      });

  if (signingError) {
    console.error(
      signingError,
    );
  }

  await supabase
    .from("transfer_offers")
    .update({
      status: "accepted",
      responded_at:
        new Date().toISOString(),
      responded_by: profile.id,
    })
    .eq("id", offer.id)
    .eq("status", "pending");

  await interaction.update({
    content:
      `✅ **Transfer accepted**\n\n` +
      `👤 ${player.display_name ?? player.username}\n` +
      `🏟️ ${seller.name} → ${buyer.name}\n` +
      `💰 Transfer fee: **${offer.fee}**\n` +
      `📝 Terms: ${offer.terms ?? "None"}\n\n` +
      `The player is now registered to **${buyer.name}**.`,
    components: [],
  });

  await notifyOfferCreator(
    interaction,
    offer.offered_by,
    `✅ Your transfer offer for **${player.display_name ?? player.username}** was accepted by **${seller.name}**.`,
  );
}

/* =========================
   REJECT TRANSFER / LOAN
========================= */

async function rejectOffer(
  interaction: ButtonInteraction,
  offerId: string,
) {
  const {
    data: offer,
    error,
  } = await supabase
    .from("transfer_offers")
    .select(
      "id,player_id,from_team_id,to_team_id,offered_by,status,offer_type",
    )
    .eq("id", offerId)
    .maybeSingle();

  if (error || !offer) {
    return interaction.reply({
      content:
        "❌ Offer not found.",
      ephemeral: true,
    });
  }

  if (offer.status !== "pending") {
    return interaction.reply({
      content:
        `⚠️ This offer has already been **${offer.status}**.`,
      ephemeral: true,
    });
  }

  if (!offer.from_team_id) {
    return interaction.reply({
      content:
        "❌ Invalid selling club.",
      ephemeral: true,
    });
  }

  const authorised =
    await canRespondToOffer(
      interaction,
      offer.from_team_id,
    );

  if (!authorised) {
    return interaction.reply({
      content:
        "❌ You aren't management of the player's current club.",
      ephemeral: true,
    });
  }

  const profile =
    await getProfileByDiscordId(
      interaction.user.id,
    );

  if (!profile) {
    return interaction.reply({
      content:
        "❌ Your Discord account isn't linked to NOVA.",
      ephemeral: true,
    });
  }

  const { data: seller } =
    await supabase
      .from("teams")
      .select("name")
      .eq("id", offer.from_team_id)
      .maybeSingle();

  await supabase
    .from("transfer_offers")
    .update({
      status: "rejected",
      responded_at:
        new Date().toISOString(),
      responded_by: profile.id,
    })
    .eq("id", offer.id)
    .eq("status", "pending");

  await interaction.update({
    content:
      `❌ **${offer.offer_type === "loan" ? "Loan" : "Transfer"} offer rejected.**`,
    components: [],
  });

  await notifyOfferCreator(
    interaction,
    offer.offered_by,
    `❌ Your ${offer.offer_type === "loan" ? "loan" : "transfer"} offer was rejected by **${seller?.name ?? "the player's club"}**.`,
  );
}

/* =========================
   ACCEPT RELEASE
========================= */

async function acceptRelease(
  interaction: ButtonInteraction,
  requestId: string,
) {
  const {
    data: request,
    error,
  } = await supabase
    .from("release_requests")
    .select(
      "id,player_id,team_id,requested_by,status",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error || !request) {
    return interaction.reply({
      content:
        "❌ Release request not found.",
      ephemeral: true,
    });
  }

  if (request.status !== "pending") {
    return interaction.reply({
      content:
        `⚠️ This release request has already been **${request.status}**.`,
      ephemeral: true,
    });
  }

  const authorised =
    await canRespondToOffer(
      interaction,
      request.team_id,
    );

  if (!authorised) {
    return interaction.reply({
      content:
        "❌ You aren't management of this player's club.",
      ephemeral: true,
    });
  }

  const profile =
    await getProfileByDiscordId(
      interaction.user.id,
    );

  if (!profile) {
    return interaction.reply({
      content:
        "❌ Your Discord account isn't linked to NOVA.",
      ephemeral: true,
    });
  }

  const { data: player } =
    await supabase
      .from("players")
      .select(
        "id,username,display_name,team_id",
      )
      .eq("id", request.player_id)
      .maybeSingle();

  if (
    !player ||
    player.team_id !== request.team_id
  ) {
    return interaction.reply({
      content:
        "❌ The player is no longer registered to this club.",
      ephemeral: true,
    });
  }

  const { error: playerError } =
    await supabase
      .from("players")
      .update({
        team_id: null,
        loan_team_id: null,
      })
      .eq("id", player.id)
      .eq("team_id", request.team_id);

  if (playerError) {
    console.error(playerError);

    return interaction.reply({
      content:
        "❌ Couldn't release the player.",
      ephemeral: true,
    });
  }

  await removePlayerFromTeam(
    player.id,
    request.team_id,
  );

  await supabase
    .from("release_requests")
    .update({
      status: "accepted",
      responded_by: profile.id,
      responded_at:
        new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("status", "pending");

  await interaction.update({
    content:
      `✅ **Release accepted**\n\n` +
      `👤 ${player.display_name ?? player.username}\n\n` +
      `The player is now a free agent.`,
    components: [],
  });

  await notifyOfferCreator(
    interaction,
    request.requested_by,
    `✅ Your release request for **${player.display_name ?? player.username}** was accepted.`,
  );
}

/* =========================
   REJECT RELEASE
========================= */

async function rejectRelease(
  interaction: ButtonInteraction,
  requestId: string,
) {
  const {
    data: request,
    error,
  } = await supabase
    .from("release_requests")
    .select(
      "id,player_id,team_id,requested_by,status",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error || !request) {
    return interaction.reply({
      content:
        "❌ Release request not found.",
      ephemeral: true,
    });
  }

  if (request.status !== "pending") {
    return interaction.reply({
      content:
        `⚠️ This release request has already been **${request.status}**.`,
      ephemeral: true,
    });
  }

  const authorised =
    await canRespondToOffer(
      interaction,
      request.team_id,
    );

  if (!authorised) {
    return interaction.reply({
      content:
        "❌ You aren't management of this player's club.",
      ephemeral: true,
    });
  }

  const profile =
    await getProfileByDiscordId(
      interaction.user.id,
    );

  if (!profile) {
    return interaction.reply({
      content:
        "❌ Your Discord account isn't linked to NOVA.",
      ephemeral: true,
    });
  }

  const { data: player } =
    await supabase
      .from("players")
      .select(
        "id,username,display_name",
      )
      .eq("id", request.player_id)
      .maybeSingle();

  await supabase
    .from("release_requests")
    .update({
      status: "rejected",
      responded_by: profile.id,
      responded_at:
        new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("status", "pending");

  await interaction.update({
    content:
      `❌ **Release request rejected.**\n\n` +
      `👤 ${player?.display_name ?? player?.username ?? "Player"}`,
    components: [],
  });

  await notifyOfferCreator(
    interaction,
    request.requested_by,
    `❌ Your release request for **${player?.display_name ?? player?.username ?? "your player"}** was rejected by club management.`,
  );
}

/* =========================
   NOTIFY OFFER CREATOR
========================= */

async function notifyOfferCreator(
  interaction: ButtonInteraction,
  profileId: string | null,
  message: string,
) {
  if (!profileId) return;

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("discord_id")
      .eq("id", profileId)
      .maybeSingle();

  if (!profile?.discord_id) return;

  try {
    const user =
      await interaction.client.users.fetch(
        profile.discord_id,
      );

    await user.send(message);
  } catch (error) {
    console.error(
      "Couldn't notify NOVA user:",
      error,
    );
  }
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
      "Add a team using a Discord role",
    )
    .addRoleOption((option) =>
      option
        .setName("team")
        .setDescription(
          "Discord role representing the team",
        )
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
      "Submit the latest completed result message",
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

  new SlashCommandBuilder()
    .setName("sign")
    .setDescription(
      "Sign an unsigned NOVA player",
    )
    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription(
          "Unsigned player to sign",
        )
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("release")
    .setDescription(
      "Release a player from your club",
    )
    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription(
          "Player to release",
        )
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("request-release")
    .setDescription(
      "Request a release from your club",
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription(
          "Optional reason for requesting release",
        )
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("roster")
    .setDescription(
      "View a NOVA team's roster",
    )
    .addRoleOption((option) =>
      option
        .setName("team")
        .setDescription(
          "Discord role representing the team",
        )
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("transfer")
    .setDescription(
      "Make a transfer offer for a player",
    )
    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription(
          "Player you want to sign",
        )
        .setRequired(true),
    )
    .addNumberOption((option) =>
      option
        .setName("fee")
        .setDescription(
          "Transfer fee",
        )
        .setMinValue(0)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("terms")
        .setDescription(
          "Optional transfer terms",
        )
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("loan")
    .setDescription(
      "Make a loan offer for a player",
    )
    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription(
          "Player you want to loan",
        )
        .setRequired(true),
    )
    .addNumberOption((option) =>
      option
        .setName("fee")
        .setDescription(
          "Loan fee",
        )
        .setMinValue(0)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("terms")
        .setDescription(
          "Optional loan terms",
        )
        .setRequired(false),
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
