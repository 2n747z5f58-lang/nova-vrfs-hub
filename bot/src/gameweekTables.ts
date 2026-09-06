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

type TableRow = {
  position: number;
  team: Team;
  standing: Standing;
};

type GuildSettings = {
  guild_id: string;
  league_id: string | null;
};

type ChannelSettings = {
  table_channel_id: string | null;
};

let watcherStarted = false;

/* =========================
   XML HELPERS
========================= */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeXmlAttribute(
  value: string,
): string {
  return escapeXml(value);
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

async function getChannelSettings(
  leagueId: string,
): Promise<ChannelSettings | null> {
  const { data, error } = await supabase
    .from("league_channel_settings")
    .select("table_channel_id")
    .eq("league_id", leagueId)
    .maybeSingle();

  if (error) {
    console.error(
      `Failed to load table channel settings for league ${leagueId}:`,
      error,
    );

    return null;
  }

  return data as ChannelSettings | null;
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
    .eq("division_id", divisionId);

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
   TABLE
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
    (team) => {
      const existing =
        standingsByTeam.get(team.id);

      return {
        position: 0,
        team,
        standing:
          existing ?? {
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
      };
    },
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
   LOGO
========================= */

function createLogoMarkup(
  team: Team,
  x: number,
  y: number,
  size: number,
): string {
  const centreX = x + size / 2;
  const centreY = y + size / 2;
  const radius = size / 2;

  if (team.logo_url) {
    return `
      <circle
        cx="${centreX}"
        cy="${centreY}"
        r="${radius}"
        fill="#1f1f1f"
      />

      <image
        href="${escapeXmlAttribute(team.logo_url)}"
        x="${x}"
        y="${y}"
        width="${size}"
        height="${size}"
        preserveAspectRatio="xMidYMid meet"
      />
    `;
  }

  const initials = team.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) =>
      word.charAt(0).toUpperCase(),
    )
    .join("");

  return `
    <circle
      cx="${centreX}"
      cy="${centreY}"
      r="${radius}"
      fill="#242424"
    />

    <text
      x="${centreX}"
      y="${centreY + 9}"
      fill="#ffffff"
      font-family="DejaVu Sans"
      font-size="22"
      font-weight="700"
      text-anchor="middle"
    >
      ${escapeXml(initials || "?")}
    </text>
  `;
}

/* =========================
   SVG
========================= */

function buildTableSvg(
  leagueName: string,
  divisionName: string,
  rows: TableRow[],
): string {
  const width = 1500;

  const topHeight = 190;
  const headerHeight = 80;
  const rowHeight = 100;
  const bottomHeight = 70;

  const height =
    topHeight +
    headerHeight +
    rows.length * rowHeight +
    bottomHeight;

  const left = 50;
  const right = 50;

  const tableWidth =
    width - left - right;

  const positionWidth = 90;
  const teamWidth = 570;
  const statWidth = 92;
  const goalDiffWidth = 105;
  const pointsWidth = 120;

  const teamX =
    left + positionWidth;

  const playedX =
    teamX + teamWidth;

  const wonX =
    playedX + statWidth;

  const drawnX =
    wonX + statWidth;

  const lostX =
    drawnX + statWidth;

  const gfX =
    lostX + statWidth;

  const gaX =
    gfX + statWidth;

  const gdX =
    gaX + statWidth;

  const pointsX =
    gdX + goalDiffWidth;

  let svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>
  <rect
    width="${width}"
    height="${height}"
    fill="#050505"
  />

  <rect
    x="0"
    y="0"
    width="${width}"
    height="${topHeight}"
    fill="#0d0d0d"
  />

  <text
    x="${left}"
    y="52"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="32"
    font-weight="800"
  >
    NOVA
  </text>

  <text
    x="${left}"
    y="108"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="42"
    font-weight="800"
  >
    ${escapeXml(leagueName)}
  </text>

  <text
    x="${left}"
    y="151"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="24"
    font-weight="500"
  >
    ${escapeXml(divisionName)} • League Table
  </text>

  <rect
    x="${left}"
    y="${topHeight}"
    width="${tableWidth}"
    height="${headerHeight}"
    fill="#171717"
  />

  <text
    x="${left + positionWidth / 2}"
    y="${topHeight + 51}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="19"
    font-weight="700"
    text-anchor="middle"
  >
    #
  </text>

  <text
    x="${teamX + 30}"
    y="${topHeight + 51}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="19"
    font-weight="700"
  >
    TEAM
  </text>

  <text
    x="${playedX + statWidth / 2}"
    y="${topHeight + 51}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="19"
    font-weight="700"
    text-anchor="middle"
  >
    P
  </text>

  <text
    x="${wonX + statWidth / 2}"
    y="${topHeight + 51}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="19"
    font-weight="700"
    text-anchor="middle"
  >
    W
  </text>

  <text
    x="${drawnX + statWidth / 2}"
    y="${topHeight + 51}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="19"
    font-weight="700"
    text-anchor="middle"
  >
    D
  </text>

  <text
    x="${lostX + statWidth / 2}"
    y="${topHeight + 51}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="19"
    font-weight="700"
    text-anchor="middle"
  >
    L
  </text>

  <text
    x="${gfX + statWidth / 2}"
    y="${topHeight + 51}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="19"
    font-weight="700"
    text-anchor="middle"
  >
    GF
  </text>

  <text
    x="${gaX + statWidth / 2}"
    y="${topHeight + 51}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="19"
    font-weight="700"
    text-anchor="middle"
  >
    GA
  </text>

  <text
    x="${gdX + goalDiffWidth / 2}"
    y="${topHeight + 51}"
    fill="#a1a1aa"
    font-family="DejaVu Sans"
    font-size="19"
    font-weight="700"
    text-anchor="middle"
  >
    GD
  </text>

  <text
    x="${pointsX + pointsWidth / 2}"
    y="${topHeight + 51}"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="19"
    font-weight="800"
    text-anchor="middle"
  >
    PTS
  </text>
`;

  rows.forEach((row, index) => {
    const y =
      topHeight +
      headerHeight +
      index * rowHeight;

    const rowFill =
      index % 2 === 0
        ? "#0b0b0b"
        : "#111111";

    svg += `
  <rect
    x="${left}"
    y="${y}"
    width="${tableWidth}"
    height="${rowHeight}"
    fill="${rowFill}"
  />

  <line
    x1="${left}"
    y1="${y + rowHeight}"
    x2="${left + tableWidth}"
    y2="${y + rowHeight}"
    stroke="#242424"
    stroke-width="1"
  />

  <text
    x="${left + positionWidth / 2}"
    y="${y + 61}"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="26"
    font-weight="800"
    text-anchor="middle"
  >
    ${row.position}
  </text>

  ${createLogoMarkup(
    row.team,
    teamX + 18,
    y + 18,
    64,
  )}

  <text
    x="${teamX + 105}"
    y="${y + 61}"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="25"
    font-weight="700"
  >
    ${escapeXml(row.team.name)}
  </text>

  <text
    x="${playedX + statWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${row.standing.played}
  </text>

  <text
    x="${wonX + statWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${row.standing.won}
  </text>

  <text
    x="${drawnX + statWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${row.standing.drawn}
  </text>

  <text
    x="${lostX + statWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${row.standing.lost}
  </text>

  <text
    x="${gfX + statWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${row.standing.goals_for}
  </text>

  <text
    x="${gaX + statWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${row.standing.goals_against}
  </text>

  <text
    x="${gdX + goalDiffWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${
      row.standing.goal_difference > 0
        ? "+"
        : ""
    }${row.standing.goal_difference}
  </text>

  <text
    x="${pointsX + pointsWidth / 2}"
    y="${y + 63}"
    fill="#ffffff"
    font-family="DejaVu Sans"
    font-size="28"
    font-weight="900"
    text-anchor="middle"
  >
    ${row.standing.points}
  </text>
`;
  });

  svg += `
  <text
    x="${width - right}"
    y="${height - 25}"
    fill="#52525b"
    font-family="DejaVu Sans"
    font-size="17"
    font-weight="600"
    text-anchor="end"
  >
    NOVA • VRFS
  </text>

</svg>
`;

  return svg;
}

/* =========================
   PNG
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
      defaultFontFamily:
        "DejaVu Sans",
    },
  });

  return renderer
    .render()
    .asPng();
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
    .eq(
      "cycle_started_at",
      cycleStartedAt,
    )
    .eq(
      "gameweek_number",
      gameweekNumber,
    )
    .maybeSingle();

  if (error) {
    console.error(
      `Failed checking table post for division ${divisionId} GW${gameweekNumber}:`,
      error,
    );

    return false;
  }

  return Boolean(data);
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

  if (!guildSettings?.guild_id) {
    console.log(
      `No Discord server connected to league ${division.league_id}.`,
    );

    return;
  }

  const channelSettings =
    await getChannelSettings(
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
      `No teams found for ${division.name}; skipping GW${gameweekNumber}.`,
    );

    return;
  }

  console.log(
    `Generating GW${gameweekNumber} table for ${leagueName} • ${division.name} using ${rows.length} teams.`,
  );

  const png =
    await generateTablePng(
      leagueName,
      division.name,
      rows,
    );

  const safeLeagueName =
    leagueName
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      );

  const safeDivisionName =
    division.name
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      );

  const filename =
    `nova-${safeLeagueName}-${safeDivisionName}-gw${gameweekNumber}-table.png`;

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
      `Failed saving table-post record for ${division.name} GW${gameweekNumber}:`,
      error,
    );

    return;
  }

  console.log(
    `✅ Posted automatic GW${gameweekNumber} table for ${leagueName} • ${division.name}.`,
  );
}

/* =========================
   GAMEWEEK COMPLETE
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
      "id,home_score,away_score",
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
      `Failed checking fixtures for division ${divisionId} GW${gameweekNumber}:`,
      error,
    );

    return false;
  }

  if (
    !fixtures ||
    fixtures.length === 0
  ) {
    return false;
  }

  return fixtures.every(
    (fixture) =>
      fixture.home_score !== null &&
      fixture.away_score !== null,
  );
}

/* =========================
   DIVISION
========================= */

async function checkDivision(
  client: Client,
  division: Division,
  leagueName: string,
): Promise<void> {
  if (
    division.status !== "active"
  ) {
    return;
  }

  if (!division.start_date) {
    console.log(
      `Active division ${division.name} has no start_date. Skipping.`,
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
   * Later gameweeks
   */

  const {
    data: gameweeks,
    error,
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

  if (error) {
    console.error(
      `Failed loading gameweeks for ${division.name}:`,
      error,
    );

    return;
  }

  if (
    !gameweeks ||
    gameweeks.length === 0
  ) {
    return;
  }

  for (const gameweek of gameweeks) {
    const number =
      Number(gameweek.number);

    if (number < 1) {
      continue;
    }

    const alreadyPosted =
      await hasTablePost(
        division.id,
        cycleStartedAt,
        number,
      );

    if (alreadyPosted) {
      continue;
    }

    const complete =
      await gameweekIsComplete(
        division.id,
        number,
      );

    if (!complete) {
      /*
       * Keep gameweeks sequential.
       */
      break;
    }

    await postTable(
      client,
      division,
      leagueName,
      number,
      cycleStartedAt,
    );
  }
}

/* =========================
   MAIN WATCHER CHECK
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
    .eq(
      "status",
      "active",
    );

  if (divisionsError) {
    console.error(
      "Failed loading active divisions:",
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
    error:
      leaguesError,
  } = await supabase
    .from("leagues")
    .select("id,name")
    .in(
      "id",
      leagueIds,
    );

  if (leaguesError) {
    console.error(
      "Failed loading leagues:",
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
   START WATCHER
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
