import {
  AttachmentBuilder,
  ChannelType,
  Client,
  Message,
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

type TablePost = {
  id: string;
  division_id: string;
  cycle_started_at: string;
  gameweek_number: number;
  channel_id: string;
  message_id: string;
};

let watcherStarted = false;

/* =========================
   LOGGING
========================= */

function log(message: string): void {
  console.log(`[GameweekTables] ${message}`);
}

function logError(message: string, error?: unknown): void {
  console.error(`[GameweekTables] ${message}`, error ?? "");
}

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

/* =========================
   DATA
========================= */

async function getGuildSettings(
  leagueId: string,
): Promise<GuildSettings | null> {
  log(`Loading Discord guild settings for league ${leagueId}...`);

  const { data, error } = await supabase
    .from("guild_settings")
    .select("guild_id,league_id")
    .eq("league_id", leagueId)
    .maybeSingle();

  if (error) {
    logError(
      `Failed to load guild settings for league ${leagueId}:`,
      error,
    );

    return null;
  }

  if (!data) {
    log(`No guild settings found for league ${leagueId}.`);
    return null;
  }

  log(`Guild connected: ${data.guild_id}`);

  return data as GuildSettings;
}

async function getChannelSettings(
  leagueId: string,
): Promise<ChannelSettings | null> {
  log(`Loading table channel for league ${leagueId}...`);

  const { data, error } = await supabase
    .from("league_channel_settings")
    .select("table_channel_id")
    .eq("league_id", leagueId)
    .maybeSingle();

  if (error) {
    logError(
      `Failed to load channel settings for league ${leagueId}:`,
      error,
    );

    return null;
  }

  if (!data?.table_channel_id) {
    log(`No table channel configured for league ${leagueId}.`);
    return data as ChannelSettings | null;
  }

  log(`Table channel configured: ${data.table_channel_id}`);

  return data as ChannelSettings;
}

async function getTeams(
  divisionId: string,
): Promise<Team[]> {
  log(`Loading teams for division ${divisionId}...`);

  const { data, error } = await supabase
    .from("teams")
    .select("id,name,logo_url")
    .eq("division_id", divisionId)
    .order("name", {
      ascending: true,
    });

  if (error) {
    logError(
      `Failed to load teams for division ${divisionId}:`,
      error,
    );

    return [];
  }

  const teams = (data ?? []) as Team[];

  log(`Found ${teams.length} team(s).`);

  for (const team of teams) {
    log(
      `Team: "${team.name}" (${team.id}) | logo: ${
        team.logo_url ? "yes" : "no"
      }`,
    );
  }

  return teams;
}

async function getStandings(
  divisionId: string,
): Promise<Standing[]> {
  log(`Loading standings for division ${divisionId}...`);

  const { data, error } = await supabase
    .from("standings")
    .select(
      "team_id,played,won,drawn,lost,goals_for,goals_against,goal_difference,points",
    )
    .eq("division_id", divisionId);

  if (error) {
    logError(
      `Failed to load standings for division ${divisionId}:`,
      error,
    );

    return [];
  }

  const standings = (data ?? []) as Standing[];

  log(`Found ${standings.length} standing row(s).`);

  for (const standing of standings) {
    log(
      `Standing ${standing.team_id}: P${standing.played} W${standing.won} D${standing.drawn} L${standing.lost} GF${standing.goals_for} GA${standing.goals_against} GD${standing.goal_difference} PTS${standing.points}`,
    );
  }

  return standings;
}

/* =========================
   TABLE
========================= */

async function buildTable(
  divisionId: string,
): Promise<TableRow[]> {
  log(`Building table data for division ${divisionId}...`);

  const [teams, standings] = await Promise.all([
    getTeams(divisionId),
    getStandings(divisionId),
  ]);

  const standingsByTeam = new Map<string, Standing>();

  for (const standing of standings) {
    standingsByTeam.set(standing.team_id, standing);
  }

  const rows: TableRow[] = teams.map((team) => {
    const existing = standingsByTeam.get(team.id);

    if (existing) {
      return {
        position: 0,
        team,
        standing: {
          ...existing,
          goal_difference:
            Number.isFinite(existing.goal_difference)
              ? existing.goal_difference
              : existing.goals_for - existing.goals_against,
        },
      };
    }

    log(
      `No standings row exists for "${team.name}". Using zeroed GW0 stats.`,
    );

    return {
      position: 0,
      team,
      standing: {
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
  });

  rows.sort((a, b) => {
    if (b.standing.points !== a.standing.points) {
      return b.standing.points - a.standing.points;
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

    if (b.standing.goals_for !== a.standing.goals_for) {
      return b.standing.goals_for - a.standing.goals_for;
    }

    return a.team.name.localeCompare(b.team.name);
  });

  rows.forEach((row, index) => {
    row.position = index + 1;
  });

  log(`Built ${rows.length} table row(s).`);

  return rows;
}

/* =========================
   LOGOS
========================= */

async function downloadLogoAsDataUri(
  url: string,
): Promise<string | null> {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 8000);

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      log(
        `Logo request failed with HTTP ${response.status}: ${url}`,
      );

      return null;
    }

    const contentType =
      response.headers.get("content-type") ?? "";

    if (!contentType.startsWith("image/")) {
      log(
        `Logo URL did not return an image (${contentType}): ${url}`,
      );

      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      log(`Logo returned an empty file: ${url}`);
      return null;
    }

    return `data:${contentType};base64,${buffer.toString(
      "base64",
    )}`;
  } catch (error) {
    logError(`Failed downloading team logo: ${url}`, error);
    return null;
  }
}

async function prepareLogos(
  rows: TableRow[],
): Promise<Map<string, string>> {
  const logos = new Map<string, string>();

  for (const row of rows) {
    if (!row.team.logo_url) {
      continue;
    }

    const dataUri = await downloadLogoAsDataUri(
      row.team.logo_url,
    );

    if (dataUri) {
      logos.set(row.team.id, dataUri);
      log(`Loaded logo for "${row.team.name}".`);
    } else {
      log(
        `Using initials fallback for "${row.team.name}".`,
      );
    }
  }

  return logos;
}

function createLogoMarkup(
  team: Team,
  logoDataUri: string | undefined,
  x: number,
  y: number,
  size: number,
): string {
  const centreX = x + size / 2;
  const centreY = y + size / 2;
  const radius = size / 2;

  if (logoDataUri) {
    return `
      <circle
        cx="${centreX}"
        cy="${centreY}"
        r="${radius}"
        fill="#242424"
      />

      <image
        href="${escapeXml(logoDataUri)}"
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
    .map((word) => word.charAt(0).toUpperCase())
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
  logos: Map<string, string>,
): string {
  const width = 1600;

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

  const tableWidth = width - left - right;

  /*
   * These widths deliberately add up to the exact table width.
   *
   * 90 + 600 + (92 × 6) + 105 + 120 = 1467
   *
   * The remaining space is given to TEAM.
   */
  const positionWidth = 90;
  const statWidth = 92;
  const goalDiffWidth = 105;
  const pointsWidth = 120;

  const teamWidth =
    tableWidth -
    positionWidth -
    statWidth * 6 -
    goalDiffWidth -
    pointsWidth;

  const teamX = left + positionWidth;
  const playedX = teamX + teamWidth;
  const wonX = playedX + statWidth;
  const drawnX = wonX + statWidth;
  const lostX = drawnX + statWidth;
  const gfX = lostX + statWidth;
  const gaX = gfX + statWidth;
  const gdX = gaX + statWidth;
  const pointsX = gdX + goalDiffWidth;

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

    const standing = row.standing;

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
    logos.get(row.team.id),
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
    ${standing.played}
  </text>

  <text
    x="${wonX + statWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${standing.won}
  </text>

  <text
    x="${drawnX + statWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${standing.drawn}
  </text>

  <text
    x="${lostX + statWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${standing.lost}
  </text>

  <text
    x="${gfX + statWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${standing.goals_for}
  </text>

  <text
    x="${gaX + statWidth / 2}"
    y="${y + 61}"
    fill="#d4d4d8"
    font-family="DejaVu Sans"
    font-size="23"
    text-anchor="middle"
  >
    ${standing.goals_against}
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
      standing.goal_difference > 0
        ? "+"
        : ""
    }${standing.goal_difference}
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
    ${standing.points}
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
  log(
    `Preparing PNG for ${leagueName} • ${divisionName} with ${rows.length} row(s)...`,
  );

  const logos = await prepareLogos(rows);

  log(
    `Prepared ${logos.size}/${rows.length} team logo(s).`,
  );

  const svg = buildTableSvg(
    leagueName,
    divisionName,
    rows,
    logos,
  );

  log(`SVG generated (${svg.length} characters).`);

  const renderer = new Resvg(svg, {
    fitTo: {
      mode: "original",
    },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: "DejaVu Sans",
    },
  });

  const png = renderer.render().asPng();

  if (!png || png.length < 100) {
    throw new Error(
      `Renderer returned an invalid PNG (${png?.length ?? 0} bytes).`,
    );
  }

  /*
   * PNG signature:
   * 89 50 4E 47 0D 0A 1A 0A
   */
  const signature = png.subarray(0, 8);

  const validSignature =
    signature.length === 8 &&
    signature[0] === 0x89 &&
    signature[1] === 0x50 &&
    signature[2] === 0x4e &&
    signature[3] === 0x47 &&
    signature[4] === 0x0d &&
    signature[5] === 0x0a &&
    signature[6] === 0x1a &&
    signature[7] === 0x0a;

  if (!validSignature) {
    throw new Error(
      "Renderer output does not contain a valid PNG signature.",
    );
  }

  log(`PNG generated successfully (${png.length} bytes).`);

  return png;
}

/* =========================
   POST TRACKING
========================= */

async function getTablePost(
  divisionId: string,
  cycleStartedAt: string,
  gameweekNumber: number,
): Promise<TablePost | null> {
  const { data, error } = await supabase
    .from("gameweek_table_posts")
    .select(
      "id,division_id,cycle_started_at,gameweek_number,channel_id,message_id",
    )
    .eq("division_id", divisionId)
    .eq("cycle_started_at", cycleStartedAt)
    .eq("gameweek_number", gameweekNumber)
    .maybeSingle();

  if (error) {
    logError(
      `Failed checking table-post tracking for division ${divisionId} GW${gameweekNumber}:`,
      error,
    );

    return null;
  }

  return data as TablePost | null;
}

/* =========================
   EXISTING POST VALIDATION
========================= */

async function fetchTrackedMessage(
  client: Client,
  post: TablePost,
): Promise<Message | null> {
  try {
    const channel = await client.channels.fetch(
      post.channel_id,
    );

    if (
      !channel ||
      channel.type !== ChannelType.GuildText
    ) {
      log(
        `Tracked channel ${post.channel_id} is no longer a text channel.`,
      );

      return null;
    }

    const message = await channel.messages.fetch(
      post.message_id,
    );

    return message;
  } catch (error) {
    logError(
      `Could not fetch tracked table message ${post.message_id}:`,
      error,
    );

    return null;
  }
}

async function isTrackedPostHealthy(
  client: Client,
  post: TablePost,
): Promise<boolean> {
  log(
    `Validating existing GW${post.gameweek_number} table post ${post.message_id}...`,
  );

  const message = await fetchTrackedMessage(
    client,
    post,
  );

  if (!message) {
    log(
      `Tracked GW${post.gameweek_number} message cannot be found. It will be repaired.`,
    );

    return false;
  }

  if (message.attachments.size === 0) {
    log(
      `Tracked GW${post.gameweek_number} message has no attachment. It will be repaired.`,
    );

    return false;
  }

  const attachment = message.attachments.first();

  if (!attachment) {
    return false;
  }

  if (
    !attachment.contentType?.startsWith("image/")
  ) {
    log(
      `Tracked GW${post.gameweek_number} attachment is not an image. It will be repaired.`,
    );

    return false;
  }

  log(
    `Existing GW${post.gameweek_number} table has a valid image attachment (${attachment.width ?? "?"}x${attachment.height ?? "?"}).`,
  );

  return true;
}

async function deleteBrokenTrackingRecord(
  post: TablePost,
): Promise<void> {
  log(
    `Removing stale tracking record ${post.id}...`,
  );

  const { error } = await supabase
    .from("gameweek_table_posts")
    .delete()
    .eq("id", post.id);

  if (error) {
    throw new Error(
      `Failed removing stale table-post record ${post.id}: ${error.message}`,
    );
  }
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
  log(
    `Starting table process for ${leagueName} • ${division.name} • GW${gameweekNumber}...`,
  );

  const existingPost = await getTablePost(
    division.id,
    cycleStartedAt,
    gameweekNumber,
  );

  if (existingPost) {
    const healthy = await isTrackedPostHealthy(
      client,
      existingPost,
    );

    if (healthy) {
      log(
        `GW${gameweekNumber} already has a healthy table post. Skipping.`,
      );

      return;
    }

    /*
     * We only reach this point when the database says the
     * table exists but Discord does not have a usable post.
     */
    await deleteBrokenTrackingRecord(
      existingPost,
    );

    log(
      `Stale GW${gameweekNumber} tracking removed. Regenerating table.`,
    );
  }

  const guildSettings =
    await getGuildSettings(
      division.league_id,
    );

  if (!guildSettings?.guild_id) {
    log(
      `Cannot post GW${gameweekNumber}: no Discord server is connected.`,
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
    log(
      `Cannot post GW${gameweekNumber}: no table channel is configured.`,
    );

    return;
  }

  const guild =
    client.guilds.cache.get(
      guildSettings.guild_id,
    );

  if (!guild) {
    log(
      `Cannot post GW${gameweekNumber}: NOVA is not connected to guild ${guildSettings.guild_id}.`,
    );

    return;
  }

  log(`Fetching table channel ${tableChannelId}...`);

  const channel =
    await guild.channels.fetch(
      tableChannelId,
    );

  if (
    !channel ||
    channel.type !== ChannelType.GuildText
  ) {
    log(
      `Configured table channel ${tableChannelId} is not a text channel.`,
    );

    return;
  }

  const rows =
    await buildTable(
      division.id,
    );

  if (rows.length === 0) {
    log(
      `No teams found for ${division.name}; GW${gameweekNumber} will not be posted.`,
    );

    return;
  }

  log(
    `Generating GW${gameweekNumber} table using ${rows.length} team(s).`,
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
    `nova-${safeLeagueName || "league"}-${safeDivisionName || "division"}-gw${gameweekNumber}-table.png`;

  const attachment =
    new AttachmentBuilder(
      png,
      {
        name: filename,
      },
    );

  log(
    `Sending GW${gameweekNumber} table to #${channel.name}...`,
  );

  const message =
    await channel.send({
      content:
        gameweekNumber === 0
          ? `🏆 **${leagueName} • ${division.name}**\n\n**GW0 Table**`
          : `🏆 **${leagueName} • ${division.name}**\n\n**GW${gameweekNumber} Table**`,
      files: [attachment],
    });

  log(
    `Discord message created: ${message.id}`,
  );

  const { error } =
    await supabase
      .from("gameweek_table_posts")
      .insert({
        division_id: division.id,
        cycle_started_at: cycleStartedAt,
        gameweek_number: gameweekNumber,
        channel_id: tableChannelId,
        message_id: message.id,
      });

  if (error) {
    logError(
      `Failed saving table-post record for ${division.name} GW${gameweekNumber}:`,
      error,
    );

    /*
     * The Discord post succeeded, so do not delete it.
     * The next watcher cycle will see the missing DB record
     * and post again if the insert failed.
     */
    return;
  }

  log(
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
  log(
    `Checking completion of division ${divisionId} GW${gameweekNumber}...`,
  );

  const {
    data: fixtures,
    error,
  } = await supabase
    .from("fixtures")
    .select(
      "id,home_score,away_score",
    )
    .eq("division_id", divisionId)
    .eq("gameweek", gameweekNumber);

  if (error) {
    logError(
      `Failed checking fixtures for division ${divisionId} GW${gameweekNumber}:`,
      error,
    );

    return false;
  }

  if (!fixtures || fixtures.length === 0) {
    log(
      `GW${gameweekNumber} has no fixtures yet.`,
    );

    return false;
  }

  const complete = fixtures.every(
    (fixture) =>
      fixture.home_score !== null &&
      fixture.away_score !== null,
  );

  log(
    `GW${gameweekNumber}: ${fixtures.length} fixture(s), complete=${complete}.`,
  );

  return complete;
}

/* =========================
   DIVISION
========================= */

async function checkDivision(
  client: Client,
  division: Division,
  leagueName: string,
): Promise<void> {
  log(
    `Checking division "${division.name}" (${division.id})...`,
  );

  if (division.status !== "active") {
    log(
      `Division "${division.name}" is not active. Skipping.`,
    );

    return;
  }

  if (!division.start_date) {
    log(
      `Active division "${division.name}" has no start_date. Skipping.`,
    );

    return;
  }

  const cycleStartedAt =
    division.start_date;

  log(
    `Current season cycle: ${cycleStartedAt}`,
  );

  const teams =
    await getTeams(
      division.id,
    );

  if (teams.length === 0) {
    log(
      `Division "${division.name}" has no teams. Nothing to post.`,
    );

    return;
  }

  /*
   * GW0
   */

  log(
    `Checking GW0 for "${division.name}"...`,
  );

  await postTable(
    client,
    division,
    leagueName,
    0,
    cycleStartedAt,
  );

  /*
   * Later gameweeks
   */

  log(
    `Loading gameweeks for "${division.name}"...`,
  );

  const {
    data: gameweeks,
    error,
  } = await supabase
    .from("gameweeks")
    .select("number")
    .eq("division_id", division.id)
    .order("number", {
      ascending: true,
    });

  if (error) {
    logError(
      `Failed loading gameweeks for ${division.name}:`,
      error,
    );

    return;
  }

  if (!gameweeks || gameweeks.length === 0) {
    log(
      `No later gameweeks exist for "${division.name}" yet.`,
    );

    return;
  }

  for (const gameweek of gameweeks) {
    const number =
      Number(gameweek.number);

    if (!Number.isFinite(number) || number < 1) {
      continue;
    }

    log(
      `Checking GW${number} for "${division.name}"...`,
    );

    const existingPost =
      await getTablePost(
        division.id,
        cycleStartedAt,
        number,
      );

    if (existingPost) {
      const healthy =
        await isTrackedPostHealthy(
          client,
          existingPost,
        );

      if (healthy) {
        log(
          `GW${number} already has a healthy post. Continuing.`,
        );

        continue;
      }

      await deleteBrokenTrackingRecord(
        existingPost,
      );

      log(
        `GW${number} had a stale tracking record. It will be regenerated when complete.`,
      );
    }

    const complete =
      await gameweekIsComplete(
        division.id,
        number,
      );

    if (!complete) {
      log(
        `GW${number} is not complete. Stopping sequential processing.`,
      );

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
  log("Starting automatic table check...");

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
    logError(
      "Failed loading active divisions:",
      divisionsError,
    );

    return;
  }

  if (!divisions || divisions.length === 0) {
    log("No active divisions found.");
    return;
  }

  log(
    `Found ${divisions.length} active division(s).`,
  );

  const leagueIds = [
    ...new Set(
      divisions.map(
        (division) =>
          division.league_id,
      ),
    ),
  ];

  log(
    `Loading ${leagueIds.length} league(s)...`,
  );

  const {
    data: leagues,
    error:
      leaguesError,
  } = await supabase
    .from("leagues")
    .select("id,name")
    .in("id", leagueIds);

  if (leaguesError) {
    logError(
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

    try {
      await checkDivision(
        client,
        division as Division,
        leagueName,
      );
    } catch (error) {
      logError(
        `Division "${division.name}" check failed:`,
        error,
      );
    }
  }

  log("Automatic table check finished.");
}

/* =========================
   START WATCHER
========================= */

export function startGameweekTableWatcher(
  client: Client,
): void {
  if (watcherStarted) {
    log("Watcher already started. Ignoring duplicate start.");
    return;
  }

  watcherStarted = true;

  log(
    "NOVA automatic Gameweek table watcher started.",
  );

  const runCheck = async () => {
    try {
      await checkGameweekTables(
        client,
      );
    } catch (error) {
      logError(
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
