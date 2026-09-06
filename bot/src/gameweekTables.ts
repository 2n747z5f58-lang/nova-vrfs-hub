import {
  AttachmentBuilder,
  ChannelType,
  Client,
} from "discord.js";
import { Resvg } from "@resvg/resvg-js";

import { supabase } from "./database.js";

type Division = {
  id: string;
  league_id: string;
  name: string;
  status: string;
  start_date: string | null;
};

type Team = {
  id: string;
  name: string;
  logo_url: string | null;
};

type Standing = {
  team_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
};

type LeagueChannelSettings = {
  table_channel_id: string | null;
};

type GuildSettings = {
  guild_id: string;
  league_id: string | null;
};

type TableRow = {
  position: number;
  team: Team;
  standing: Standing;
};

let watcherStarted = false;

/* =========================
   HELPERS
========================= */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0].charAt(0) +
    words[1].charAt(0)
  ).toUpperCase();
}

/* =========================
   TABLE SVG
========================= */

function buildTableSvg(
  leagueName: string,
  divisionName: string,
  rows: TableRow[],
): string {
  const width = 1400;

  const headerHeight = 180;
  const rowHeight = 88;
  const footerHeight = 70;

  const height =
    headerHeight +
    rows.length * rowHeight +
    footerHeight;

  const columns = {
    position: 90,
    team: 610,
    played: 95,
    won: 95,
    drawn: 95,
    lost: 95,
    gf: 95,
    ga: 95,
    gd: 105,
    points: 130,
  };

  const tableX = 50;
  const tableWidth = width - 100;

  const teamX =
    tableX + columns.position;

  const playedX =
    teamX + columns.team;

  const wonX =
    playedX + columns.played;

  const drawnX =
    wonX + columns.won;

  const lostX =
    drawnX + columns.drawn;

  const gfX =
    lostX + columns.lost;

  const gaX =
    gfX + columns.gf;

  const gdX =
    gaX + columns.ga;

  const pointsX =
    gdX + columns.gd;

  const headerY = 105;

  let svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>
  <rect
    x="0"
    y="0"
    width="${width}"
    height="${height}"
    fill="#050505"
  />

  <rect
    x="0"
    y="0"
    width="${width}"
    height="${headerHeight}"
    fill="#0d0d0d"
  />

  <text
    x="50"
    y="58"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="34"
    font-weight="700"
  >
    NOVA
  </text>

  <text
    x="50"
    y="105"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="42"
    font-weight="700"
  >
    ${escapeXml(leagueName)}
  </text>

  <text
    x="50"
    y="145"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="25"
    font-weight="500"
  >
    ${escapeXml(divisionName)} • League Table
  </text>

  <rect
    x="${tableX}"
    y="${headerHeight}"
    width="${tableWidth}"
    height="${rowHeight}"
    fill="#161616"
  />

  <text
    x="${tableX + columns.position / 2}"
    y="${headerY + headerHeight - 105}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="20"
    font-weight="700"
    text-anchor="middle"
  >
    #
  </text>

  <text
    x="${teamX + 25}"
    y="${headerY + headerHeight - 105}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="20"
    font-weight="700"
  >
    TEAM
  </text>

  <text
    x="${playedX + columns.played / 2}"
    y="${headerY + headerHeight - 105}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="20"
    font-weight="700"
    text-anchor="middle"
  >
    P
  </text>

  <text
    x="${wonX + columns.won / 2}"
    y="${headerY + headerHeight - 105}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="20"
    font-weight="700"
    text-anchor="middle"
  >
    W
  </text>

  <text
    x="${drawnX + columns.drawn / 2}"
    y="${headerY + headerHeight - 105}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="20"
    font-weight="700"
    text-anchor="middle"
  >
    D
  </text>

  <text
    x="${lostX + columns.lost / 2}"
    y="${headerY + headerHeight - 105}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="20"
    font-weight="700"
    text-anchor="middle"
  >
    L
  </text>

  <text
    x="${gfX + columns.gf / 2}"
    y="${headerY + headerHeight - 105}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="20"
    font-weight="700"
    text-anchor="middle"
  >
    GF
  </text>

  <text
    x="${gaX + columns.ga / 2}"
    y="${headerY + headerHeight - 105}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="20"
    font-weight="700"
    text-anchor="middle"
  >
    GA
  </text>

  <text
    x="${gdX + columns.gd / 2}"
    y="${headerY + headerHeight - 105}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="20"
    font-weight="700"
    text-anchor="middle"
  >
    GD
  </text>

  <text
    x="${pointsX + columns.points / 2}"
    y="${headerY + headerHeight - 105}"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="20"
    font-weight="700"
    text-anchor="middle"
  >
    PTS
  </text>
`;

  rows.forEach((row, index) => {
    const y =
      headerHeight +
      rowHeight +
      index * rowHeight;

    const standing = row.standing;

    const rowBackground =
      index % 2 === 0
        ? "#0d0d0d"
        : "#111111";

    svg += `
  <rect
    x="${tableX}"
    y="${y}"
    width="${tableWidth}"
    height="${rowHeight}"
    fill="${rowBackground}"
  />

  <line
    x1="${tableX}"
    y1="${y + rowHeight}"
    x2="${tableX + tableWidth}"
    y2="${y + rowHeight}"
    stroke="#242424"
    stroke-width="1"
  />

  <text
    x="${tableX + columns.position / 2}"
    y="${y + 56}"
    fill="${index < 4 ? "#ffffff" : "#a1a1aa"}"
    font-family="DejaVu Sans"
    font-size="25"
    font-weight="700"
    text-anchor="middle"
  >
    ${row.position}
  </text>

  <circle
    cx="${teamX + 25}"
    cy="${y + rowHeight / 2}"
    r="25"
    fill="#202020"
  />

  <text
    x="${teamX + 25}"
    y="${y + rowHeight / 2 + 8}"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="17"
    font-weight="700"
    text-anchor="middle"
  >
    ${escapeXml(getInitials(row.team.name))}
  </text>

  <text
    x="${teamX + 65}"
    y="${y + 55}"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="24"
    font-weight="600"
  >
    ${escapeXml(row.team.name)}
  </text>

  <text
    x="${playedX + columns.played / 2}"
    y="${y + 55}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${formatNumber(standing.played)}
  </text>

  <text
    x="${wonX + columns.won / 2}"
    y="${y + 55}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${formatNumber(standing.won)}
  </text>

  <text
    x="${drawnX + columns.drawn / 2}"
    y="${y + 55}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${formatNumber(standing.drawn)}
  </text>

  <text
    x="${lostX + columns.lost / 2}"
    y="${y + 55}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${formatNumber(standing.lost)}
  </text>

  <text
    x="${gfX + columns.gf / 2}"
    y="${y + 55}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${formatNumber(standing.goals_for)}
  </text>

  <text
    x="${gaX + columns.ga / 2}"
    y="${y + 55}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${formatNumber(standing.goals_against)}
  </text>

  <text
    x="${gdX + columns.gd / 2}"
    y="${y + 55}"
    fill="${standing.goal_difference >= 0 ? "#d4d4d8" : "#f4f4f5"}"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${standing.goal_difference > 0 ? "+" : ""}${formatNumber(standing.goal_difference)}
  </text>

  <text
    x="${pointsX + columns.points / 2}"
    y="${y + 57}"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="28"
    font-weight="800"
    text-anchor="middle"
  >
    ${formatNumber(standing.points)}
  </text>
`;
  });

  svg += `
  <text
    x="${width - 50}"
    y="${height - 25}"
    fill="#52525b"
    font-family="DejaVu Sans"
    font-size="17"
    text-anchor="end"
  >
    NOVA • VRFS
  </text>

</svg>
`;

  return svg;
}

/* =========================
   DATA
========================= */

async function getGuildSettings(
  leagueId: string,
): Promise<GuildSettings | null> {
  const { data, error } = await supabase
    .from("guild_settings")
    .select("guild_id,league_id")
    .eq("league_id", leagueId)
    .maybeSingle();

  if (error) {
    console.error(
      `Failed to load guild settings for league ${leagueId}:`,
      error,
    );

    return null;
  }

  return data as GuildSettings | null;
}

async function getTableChannelSettings(
  leagueId: string,
): Promise<LeagueChannelSettings | null> {
  const { data, error } = await supabase
    .from("league_channel_settings")
    .select("table_channel_id")
    .eq("league_id", leagueId)
    .maybeSingle();

  if (error) {
    console.error(
      `Failed to load channel settings for league ${leagueId}:`,
      error,
    );

    return null;
  }

  return data as LeagueChannelSettings | null;
}

async function getTeams(
  divisionId: string,
): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id,name,logo_url")
    .eq("division_id", divisionId)
    .order("name", {
      ascending: true,
    });

  if (error) {
    console.error(
      `Failed to load teams for division ${divisionId}:`,
      error,
    );

    return [];
  }

  return (data ?? []) as Team[];
}

async function getStandings(
  divisionId: string,
): Promise<Standing[]> {
  const { data, error } = await supabase
    .from("standings")
    .select(
      "team_id,played,won,drawn,lost,goals_for,goals_against,goal_difference,points",
    )
    .eq("division_id", divisionId)
    .order("points", {
      ascending: false,
    })
    .order("goal_difference", {
      ascending: false,
    })
    .order("goals_for", {
      ascending: false,
    });

  if (error) {
    console.error(
      `Failed to load standings for division ${divisionId}:`,
      error,
    );

    return [];
  }

  return (data ?? []) as Standing[];
}

/* =========================
   POST TRACKING
========================= */

async function hasTablePost(
  divisionId: string,
  cycleStartedAt: string,
  gameweekNumber: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("gameweek_table_posts")
    .select("id")
    .eq("division_id", divisionId)
    .eq("cycle_started_at", cycleStartedAt)
    .eq("gameweek_number", gameweekNumber)
    .maybeSingle();

  if (error) {
    console.error(
      `Failed to check table post for division ${divisionId}, GW${gameweekNumber}:`,
      error,
    );

    return false;
  }

  return Boolean(data);
}

/* =========================
   IMAGE GENERATION
========================= */

async function generateTablePng(
  leagueName: string,
  divisionName: string,
  rows: TableRow[],
): Promise<Buffer> {
  const svg = buildTableSvg(
    leagueName,
    divisionName,
    rows,
  );

  const renderer = new Resvg(svg, {
    fitTo: {
      mode: "original",
    },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: "DejaVu Sans",
    },
  });

  return renderer
    .render()
    .asPng();
}

/* =========================
   TABLE BUILDING
========================= */

async function buildTable(
  divisionId: string,
): Promise<TableRow[]> {
  const [teams, standings] =
    await Promise.all([
      getTeams(divisionId),
      getStandings(divisionId),
    ]);

  const standingsByTeam =
    new Map<string, Standing>();

  for (const standing of standings) {
    standingsByTeam.set(
      standing.team_id,
      standing,
    );
  }

  const rows: TableRow[] = teams.map(
    (team) => ({
      position: 0,
      team,
      standing:
        standingsByTeam.get(team.id) ?? {
          team_id: team.id,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goals_for: 0,
          goals_against: 0,
          goal_difference: 0,
          points: 0,
        },
    }),
  );

  rows.sort((a, b) => {
    if (
      b.standing.points !==
      a.standing.points
    ) {
      return (
        b.standing.points -
        a.standing.points
      );
    }

    if (
      b.standing.goal_difference !==
      a.standing.goal_difference
    ) {
      return (
        b.standing.goal_difference -
        a.standing.goal_difference
      );
    }

    if (
      b.standing.goals_for !==
      a.standing.goals_for
    ) {
      return (
        b.standing.goals_for -
        a.standing.goals_for
      );
    }

    return a.team.name.localeCompare(
      b.team.name,
    );
  });

  rows.forEach((row, index) => {
    row.position = index + 1;
  });

  return rows;
}

/* =========================
   POST TABLE
========================= */

async function postTable(
  client: Client,
  division: Division,
  leagueName: string,
  gameweekNumber: number,
  cycleStartedAt: string,
): Promise<void> {
  const alreadyPosted =
    await hasTablePost(
      division.id,
      cycleStartedAt,
      gameweekNumber,
    );

  if (alreadyPosted) {
    return;
  }

  const guildSettings =
    await getGuildSettings(
      division.league_id,
    );

  if (
    !guildSettings?.guild_id
  ) {
    console.log(
      `No Discord guild connected to league ${division.league_id}.`,
    );

    return;
  }

  const channelSettings =
    await getTableChannelSettings(
      division.league_id,
    );

  const tableChannelId =
    channelSettings?.table_channel_id;

  if (!tableChannelId) {
    console.log(
      `No table channel configured for league ${division.league_id}.`,
    );

    return;
  }

  const guild =
    client.guilds.cache.get(
      guildSettings.guild_id,
    );

  if (!guild) {
    console.log(
      `NOVA is not connected to guild ${guildSettings.guild_id}.`,
    );

    return;
  }

  const channel =
    await guild.channels.fetch(
      tableChannelId,
    );

  if (
    !channel ||
    channel.type !== ChannelType.GuildText
  ) {
    console.log(
      `Configured table channel ${tableChannelId} is not a text channel.`,
    );

    return;
  }

  const rows =
    await buildTable(
      division.id,
    );

  if (rows.length === 0) {
    console.log(
      `No teams in ${division.name}; skipping GW${gameweekNumber} table.`,
    );

    return;
  }

  const png =
    await generateTablePng(
      leagueName,
      division.name,
      rows,
    );

  const filename =
    `nova-${leagueName}-${division.name}-gw${gameweekNumber}-table.png`
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-");

  const attachment =
    new AttachmentBuilder(
      png,
      {
        name: filename,
      },
    );

  const message =
    await channel.send({
      content:
        gameweekNumber === 0
          ? `🏆 **${leagueName} • ${division.name}**\n\n**GW0 Table**`
          : `🏆 **${leagueName} • ${division.name}**\n\n**GW${gameweekNumber} Table**`,
      files: [attachment],
    });

  const { error } =
    await supabase
      .from("gameweek_table_posts")
      .insert({
        division_id: division.id,
        cycle_started_at:
          cycleStartedAt,
        gameweek_number:
          gameweekNumber,
        channel_id:
          tableChannelId,
        message_id:
          message.id,
      });

  if (error) {
    console.error(
      `Failed to save table post record for ${division.name} GW${gameweekNumber}:`,
      error,
    );

    return;
  }

  console.log(
    `Posted automatic GW${gameweekNumber} table for ${leagueName} • ${division.name}.`,
  );
}

/* =========================
   FIXTURE CHECK
========================= */

async function gameweekIsComplete(
  divisionId: string,
  gameweekNumber: number,
): Promise<boolean> {
  const {
    data: fixtures,
    error,
  } = await supabase
    .from("fixtures")
    .select(
      "id,home_score,away_score,status",
    )
    .eq(
      "division_id",
      divisionId,
    )
    .eq(
      "gameweek",
      gameweekNumber,
    );

  if (error) {
    console.error(
      `Failed to check fixtures for division ${divisionId} GW${gameweekNumber}:`,
      error,
    );

    return false;
  }

  if (!fixtures || fixtures.length === 0) {
    return false;
  }

  return fixtures.every(
    (fixture) =>
      fixture.home_score !== null &&
      fixture.away_score !== null,
  );
}

/* =========================
   DIVISION CHECK
========================= */

async function checkDivision(
  client: Client,
  division: Division,
  leagueName: string,
): Promise<void> {
  if (division.status !== "active") {
    return;
  }

  if (!division.start_date) {
    console.log(
      `Active division ${division.name} has no start_date; skipping automatic tables.`,
    );

    return;
  }

  const cycleStartedAt =
    division.start_date;

  const teams =
    await getTeams(
      division.id,
    );

  if (teams.length === 0) {
    return;
  }

  /*
   * GW0
   *
   * Posted once for this specific
   * division + start_date cycle.
   */
  const gw0Posted =
    await hasTablePost(
      division.id,
      cycleStartedAt,
      0,
    );

  if (!gw0Posted) {
    await postTable(
      client,
      division,
      leagueName,
      0,
      cycleStartedAt,
    );
  }

  /*
   * Find all gameweeks belonging
   * to this division.
   */
  const {
    data: gameweeks,
    error:
      gameweeksError,
  } = await supabase
    .from("gameweeks")
    .select("number")
    .eq(
      "division_id",
      division.id,
    )
    .order("number", {
      ascending: true,
    });

  if (gameweeksError) {
    console.error(
      `Failed to load gameweeks for ${division.name}:`,
      gameweeksError,
    );

    return;
  }

  if (
    !gameweeks ||
    gameweeks.length === 0
  ) {
    return;
  }

  /*
   * Only post a gameweek table once
   * every fixture in that gameweek
   * has both scores recorded.
   */
  for (const gameweek of gameweeks) {
    const gameweekNumber =
      Number(gameweek.number);

    if (
      gameweekNumber < 1
    ) {
      continue;
    }

    const alreadyPosted =
      await hasTablePost(
        division.id,
        cycleStartedAt,
        gameweekNumber,
      );

    if (alreadyPosted) {
      continue;
    }

    const complete =
      await gameweekIsComplete(
        division.id,
        gameweekNumber,
      );

    if (!complete) {
      /*
       * Gameweeks are sequential.
       * Don't post GW2 while GW1 is
       * still unfinished.
       */
      break;
    }

    await postTable(
      client,
      division,
      leagueName,
      gameweekNumber,
      cycleStartedAt,
    );
  }
}

/* =========================
   MAIN CHECK
========================= */

async function checkGameweekTables(
  client: Client,
): Promise<void> {
  const {
    data: divisions,
    error:
      divisionsError,
  } = await supabase
    .from("divisions")
    .select(
      "id,league_id,name,status,start_date",
    )
    .eq("status", "active");

  if (divisionsError) {
    console.error(
      "Failed to load active divisions for automatic tables:",
      divisionsError,
    );

    return;
  }

  if (
    !divisions ||
    divisions.length === 0
  ) {
    return;
  }

  const leagueIds = [
    ...new Set(
      divisions.map(
        (division) =>
          division.league_id,
      ),
    ),
  ];

  const {
    data: leagues,
    error: leaguesError,
  } = await supabase
    .from("leagues")
    .select("id,name")
    .in("id", leagueIds);

  if (leaguesError) {
    console.error(
      "Failed to load leagues for automatic tables:",
      leaguesError,
    );

    return;
  }

  const leagueNames =
    new Map<string, string>();

  for (const league of leagues ?? []) {
    leagueNames.set(
      league.id,
      league.name,
    );
  }

  for (const division of divisions) {
    const leagueName =
      leagueNames.get(
        division.league_id,
      ) ??
      "NOVA League";

    await checkDivision(
      client,
      division as Division,
      leagueName,
    );
  }
}

/* =========================
   WATCHER
========================= */

export function startGameweekTableWatcher(
  client: Client,
): void {
  if (watcherStarted) {
    return;
  }

  watcherStarted = true;

  console.log(
    "NOVA automatic Gameweek table watcher started.",
  );

  const runCheck = async () => {
    try {
      await checkGameweekTables(
        client,
      );
    } catch (error) {
      console.error(
        "Automatic Gameweek table watcher error:",
        error,
      );
    }
  };

  void runCheck();

  setInterval(
    () => {
      void runCheck();
    },
    30_000,
  );
}
