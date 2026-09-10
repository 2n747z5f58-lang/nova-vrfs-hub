import {
  AttachmentBuilder,
  ChannelType,
  Client,
} from "discord.js";
import { Resvg } from "@resvg/resvg-js";
import {
  existsSync,
  readFileSync,
} from "node:fs";
import {
  dirname,
  join,
} from "node:path";
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

type TrackedPost = {
  id: string;
  channel_id: string;
  message_id: string;
};

const FONT_FAMILY = "DejaVu Sans";

const FONT_CANDIDATES = [
  join(process.cwd(), "fonts", "DejaVuSans.ttf"),
  join(process.cwd(), "bot", "fonts", "DejaVuSans.ttf"),
];

const FOUND_FONT_PATH = FONT_CANDIDATES.find((path) =>
  existsSync(path),
);

if (!FOUND_FONT_PATH) {
  throw new Error(
    [
      "[GameweekTables] DejaVuSans.ttf was not found.",
      "Checked:",
      ...FONT_CANDIDATES.map((path) => `  ${path}`),
    ].join("\n"),
  );
}

const FONT_PATH: string = FOUND_FONT_PATH;

console.log(
  `[GameweekTables] Font file found: ${FONT_PATH}`,
);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncateText(
  value: string,
  maxLength: number,
): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

async function getGuildSettings(
  leagueId: string,
): Promise<{ guild_id: string } | null> {
  const { data, error } = await supabase
    .from("guild_settings")
    .select("guild_id")
    .eq("league_id", leagueId)
    .maybeSingle();

  if (error) {
    console.error(
      "[GameweekTables] Failed to load guild settings:",
      error,
    );
    return null;
  }

  return data;
}

async function getChannelSettings(
  leagueId: string,
): Promise<{
  table_channel_id: string | null;
} | null> {
  const { data, error } = await supabase
    .from("league_channel_settings")
    .select("table_channel_id")
    .eq("league_id", leagueId)
    .maybeSingle();

  if (error) {
    console.error(
      "[GameweekTables] Failed to load channel settings:",
      error,
    );
    return null;
  }

  return data;
}

async function getTeams(
  divisionId: string,
): Promise<Team[]> {
  console.log(
    `[GameweekTables] Loading teams for division ${divisionId}...`,
  );

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, logo_url")
    .eq("division_id", divisionId)
    .order("name", {
      ascending: true,
    });

  if (error) {
    console.error(
      "[GameweekTables] Failed to load teams:",
      error,
    );
    return [];
  }

  const teams = (data ?? []) as Team[];

  console.log(
    `[GameweekTables] Found ${teams.length} team(s).`,
  );

  for (const team of teams) {
    console.log(
      `[GameweekTables] Team "${team.name}" (${team.id}) | logo URL: ${
        team.logo_url ? "present" : "missing"
      }`,
    );
  }

  return teams;
}

async function getStandings(
  divisionId: string,
): Promise<Standing[]> {
  console.log(
    `[GameweekTables] Loading standings for division ${divisionId}...`,
  );

  const { data, error } = await supabase
    .from("standings")
    .select(
      "team_id, played, won, drawn, lost, goals_for, goals_against, goal_difference, points",
    )
    .eq("division_id", divisionId);

  if (error) {
    console.error(
      "[GameweekTables] Failed to load standings:",
      error,
    );
    return [];
  }

  const standings = (data ?? []) as Standing[];

  console.log(
    `[GameweekTables] Found ${standings.length} standing row(s).`,
  );

  return standings;
}

function buildTable(
  teams: Team[],
  standings: Standing[],
): TableRow[] {
  const standingMap = new Map<string, Standing>();

  for (const standing of standings) {
    standingMap.set(standing.team_id, {
      team_id: standing.team_id,
      played: Number(standing.played ?? 0),
      won: Number(standing.won ?? 0),
      drawn: Number(standing.drawn ?? 0),
      lost: Number(standing.lost ?? 0),
      goals_for: Number(standing.goals_for ?? 0),
      goals_against: Number(standing.goals_against ?? 0),
      goal_difference: Number(
        standing.goal_difference ?? 0,
      ),
      points: Number(standing.points ?? 0),
    });
  }

  const rows: TableRow[] = teams.map((team) => ({
    position: 0,
    team,
    standing:
      standingMap.get(team.id) ?? {
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
  }));

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
      return (
        b.standing.goals_for -
        a.standing.goals_for
      );
    }

    return a.team.name.localeCompare(b.team.name);
  });

  rows.forEach((row, index) => {
    row.position = index + 1;
  });

  return rows;
}

/**
 * Discord attachment URLs can expire.
 *
 * We attempt to download the stored logo, but a failed download
 * must never remove the team from the table. In that situation
 * the table receives a generated badge using the team's initials.
 */
async function downloadLogo(
  team: Team,
): Promise<{
  dataUrl: string;
  contentType: string;
} | null> {
  if (!team.logo_url) {
    console.log(
      `[GameweekTables] No logo URL for "${team.name}".`,
    );
    return null;
  }

  try {
    const response = await fetch(team.logo_url, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.log(
        `[GameweekTables] Logo request failed for "${team.name}" with HTTP ${response.status}.`,
      );
      return null;
    }

    const contentType =
      response.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().startsWith("image/")) {
      console.log(
        `[GameweekTables] Logo for "${team.name}" returned invalid content type: ${contentType}`,
      );
      return null;
    }

    const buffer = Buffer.from(
      await response.arrayBuffer(),
    );

    if (!buffer.length) {
      console.log(
        `[GameweekTables] Logo for "${team.name}" returned an empty body.`,
      );
      return null;
    }

    console.log(
      `[GameweekTables] Successfully downloaded logo for "${team.name}" (${buffer.length} bytes).`,
    );

    return {
      dataUrl: `data:${contentType};base64,${buffer.toString(
        "base64",
      )}`,
      contentType,
    };
  } catch (error) {
    console.error(
      `[GameweekTables] Failed to download logo for "${team.name}":`,
      error,
    );

    return null;
  }
}

function createFallbackBadge(
  team: Team,
  x: number,
  y: number,
  size: number,
): string {
  const initials =
    team.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const cx = x + size / 2;
  const cy = y + size / 2;

  return `
    <circle
      cx="${cx}"
      cy="${cy}"
      r="${size / 2}"
      fill="#252525"
      stroke="#555555"
      stroke-width="2"
    />
    <text
      x="${cx}"
      y="${cy + 8}"
      text-anchor="middle"
      font-family="${FONT_FAMILY}"
      font-size="22"
      font-weight="700"
      fill="#ffffff"
    >${escapeXml(initials)}</text>
  `;
}

async function createLogoMarkup(
  team: Team,
  x: number,
  y: number,
  size: number,
): Promise<string> {
  const logo = await downloadLogo(team);

  if (!logo) {
    return createFallbackBadge(
      team,
      x,
      y,
      size,
    );
  }

  /*
   * Do not use clipPath here.
   *
   * The image is rendered directly into a square box. This avoids
   * the SVG image + clipPath combination being a second possible
   * rendering failure point.
   */
  return `
    <image
      href="${logo.dataUrl}"
      x="${x}"
      y="${y}"
      width="${size}"
      height="${size}"
      preserveAspectRatio="xMidYMid meet"
    />
  `;
}

async function buildTableSvg(
  division: Division,
  rows: TableRow[],
): Promise<string> {
  const width = 1600;

  const topHeight = 190;
  const headerHeight = 80;
  const rowHeight = 100;
  const footerHeight = 70;

  const left = 50;
  const right = 50;

  const tableWidth = width - left - right;

  const positionWidth = 80;
  const teamWidth = 540;
  const statWidth = 90;
  const goalDiffWidth = 105;
  const pointsWidth = 120;

  const statColumnsWidth = statWidth * 6;

  const actualTeamWidth =
    tableWidth -
    positionWidth -
    statColumnsWidth -
    goalDiffWidth -
    pointsWidth;

  const finalTeamWidth = Math.max(
    teamWidth,
    actualTeamWidth,
  );

  const bodyStartY =
    topHeight + headerHeight;

  const height =
    topHeight +
    headerHeight +
    rows.length * rowHeight +
    footerHeight;

  const svgParts: string[] = [];

  svgParts.push(`
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
        fill="#080808"
      />

      <text
        x="${left}"
        y="70"
        font-family="${FONT_FAMILY}"
        font-size="48"
        font-weight="700"
        fill="#ffffff"
      >NOVA</text>

      <text
        x="${left}"
        y="125"
        font-family="${FONT_FAMILY}"
        font-size="30"
        font-weight="700"
        fill="#ffffff"
      >${escapeXml(division.name)}</text>

      <text
        x="${width - right}"
        y="70"
        text-anchor="end"
        font-family="${FONT_FAMILY}"
        font-size="22"
        font-weight="700"
        fill="#aaaaaa"
      >LEAGUE TABLE</text>

      <text
        x="${width - right}"
        y="110"
        text-anchor="end"
        font-family="${FONT_FAMILY}"
        font-size="18"
        font-weight="400"
        fill="#666666"
      >VRFS • NOVA</text>

      <rect
        x="${left}"
        y="${topHeight}"
        width="${tableWidth}"
        height="${headerHeight}"
        rx="12"
        fill="#171717"
      />
  `);

  const teamX =
    left + positionWidth;

  const statsX =
    teamX + finalTeamWidth;

  const headers = [
    {
      label: "#",
      x: left + positionWidth / 2,
      anchor: "middle",
    },
    {
      label: "TEAM",
      x: teamX + 25,
      anchor: "start",
    },
    {
      label: "P",
      x: statsX + statWidth / 2,
      anchor: "middle",
    },
    {
      label: "W",
      x: statsX + statWidth * 1.5,
      anchor: "middle",
    },
    {
      label: "D",
      x: statsX + statWidth * 2.5,
      anchor: "middle",
    },
    {
      label: "L",
      x: statsX + statWidth * 3.5,
      anchor: "middle",
    },
    {
      label: "GF",
      x: statsX + statWidth * 4.5,
      anchor: "middle",
    },
    {
      label: "GA",
      x: statsX + statWidth * 5.5,
      anchor: "middle",
    },
    {
      label: "GD",
      x:
        statsX +
        statWidth * 6 +
        goalDiffWidth / 2,
      anchor: "middle",
    },
    {
      label: "PTS",
      x:
        statsX +
        statWidth * 6 +
        goalDiffWidth +
        pointsWidth / 2,
      anchor: "middle",
    },
  ];

  for (const header of headers) {
    svgParts.push(`
      <text
        x="${header.x}"
        y="${topHeight + 51}"
        text-anchor="${header.anchor}"
        font-family="${FONT_FAMILY}"
        font-size="21"
        font-weight="700"
        fill="#888888"
      >${header.label}</text>
    `);
  }

  for (
    let index = 0;
    index < rows.length;
    index++
  ) {
    const row = rows[index];

    const y =
      bodyStartY +
      index * rowHeight;

    const centerY =
      y + rowHeight / 2;

    const background =
      index % 2 === 0
        ? "#0c0c0c"
        : "#111111";

    svgParts.push(`
      <rect
        x="${left}"
        y="${y}"
        width="${tableWidth}"
        height="${rowHeight}"
        fill="${background}"
      />

      <text
        x="${left + positionWidth / 2}"
        y="${centerY + 9}"
        text-anchor="middle"
        font-family="${FONT_FAMILY}"
        font-size="25"
        font-weight="700"
        fill="#ffffff"
      >${row.position}</text>
    `);

    const logoSize = 58;

    const logoX =
      teamX + 18;

    const logoY =
      centerY - logoSize / 2;

    svgParts.push(
      await createLogoMarkup(
        row.team,
        logoX,
        logoY,
        logoSize,
      ),
    );

    svgParts.push(`
      <text
        x="${logoX + logoSize + 20}"
        y="${centerY + 8}"
        font-family="${FONT_FAMILY}"
        font-size="25"
        font-weight="700"
        fill="#ffffff"
      >${escapeXml(
        truncateText(
          row.team.name,
          28,
        ),
      )}</text>
    `);

    const values = [
      row.standing.played,
      row.standing.won,
      row.standing.drawn,
      row.standing.lost,
      row.standing.goals_for,
      row.standing.goals_against,
    ];

    for (
      let valueIndex = 0;
      valueIndex < values.length;
      valueIndex++
    ) {
      const x =
        statsX +
        statWidth * valueIndex +
        statWidth / 2;

      svgParts.push(`
        <text
          x="${x}"
          y="${centerY + 8}"
          text-anchor="middle"
          font-family="${FONT_FAMILY}"
          font-size="24"
          font-weight="400"
          fill="#dddddd"
        >${values[valueIndex]}</text>
      `);
    }

    const gd =
      row.standing.goal_difference;

    const gdX =
      statsX +
      statWidth * 6 +
      goalDiffWidth / 2;

    svgParts.push(`
      <text
        x="${gdX}"
        y="${centerY + 8}"
        text-anchor="middle"
        font-family="${FONT_FAMILY}"
        font-size="24"
        font-weight="400"
        fill="#dddddd"
      >${
        gd > 0 ? "+" : ""
      }${gd}</text>
    `);

    const pointsX =
      statsX +
      statWidth * 6 +
      goalDiffWidth +
      pointsWidth / 2;

    svgParts.push(`
      <text
        x="${pointsX}"
        y="${centerY + 8}"
        text-anchor="middle"
        font-family="${FONT_FAMILY}"
        font-size="27"
        font-weight="700"
        fill="#ffffff"
      >${row.standing.points}</text>
    `);

    svgParts.push(`
      <line
        x1="${left}"
        y1="${y + rowHeight - 1}"
        x2="${left + tableWidth}"
        y2="${y + rowHeight - 1}"
        stroke="#222222"
        stroke-width="1"
      />
    `);
  }

  const footerY =
    bodyStartY +
    rows.length * rowHeight;

  svgParts.push(`
      <text
        x="${left}"
        y="${footerY + 44}"
        font-family="${FONT_FAMILY}"
        font-size="17"
        font-weight="400"
        fill="#666666"
      >Generated automatically by NOVA</text>

      <text
        x="${width - right}"
        y="${footerY + 44}"
        text-anchor="end"
        font-family="${FONT_FAMILY}"
        font-size="17"
        font-weight="400"
        fill="#666666"
      >${rows.length} TEAM${
    rows.length === 1 ? "" : "S"
  }</text>

    </svg>
  `);

  return svgParts.join("");
}

async function generateTablePng(
  division: Division,
  rows: TableRow[],
): Promise<Buffer> {
  console.log(
    `[GameweekTables] Generating PNG for ${division.name}...`,
  );

  console.log(
    `[GameweekTables] Font path: ${FONT_PATH}`,
  );

  const fontDirectory =
    dirname(FONT_PATH);

  /*
   * The SVG now explicitly uses:
   *
   * font-family="DejaVu Sans"
   *
   * everywhere.
   *
   * This avoids relying on generic "sans-serif" resolution.
   *
   * Resvg supports loading local font files through fontFiles.
   */
  const svg =
    await buildTableSvg(
      division,
      rows,
    );

  console.log(
    `[GameweekTables] SVG generated (${svg.length} characters).`,
  );

  const resvg =
    new Resvg(svg, {
      font: {
        fontFiles: [
          FONT_PATH,
        ],
        fontDirs: [
          fontDirectory,
        ],
        loadSystemFonts: false,
        defaultFontFamily:
          FONT_FAMILY,
        sansSerifFamily:
          FONT_FAMILY,
        serifFamily:
          FONT_FAMILY,
        monospaceFamily:
          FONT_FAMILY,
      },
      textRendering: 2,
      shapeRendering: 2,
      logLevel: "warn",
    });

  const rendered =
    resvg.render();

  const png =
    rendered.asPng();

  if (!png || png.length === 0) {
    throw new Error(
      "Resvg returned an empty PNG.",
    );
  }

  console.log(
    `[GameweekTables] Generated PNG successfully (${png.length} bytes).`,
  );

  return png;
}

async function getTablePost(
  divisionId: string,
  cycleStartedAt: string,
  gameweekNumber: number,
): Promise<TrackedPost | null> {
  const { data, error } =
    await supabase
      .from("gameweek_table_posts")
      .select(
        "id, channel_id, message_id",
      )
      .eq(
        "division_id",
        divisionId,
      )
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
      "[GameweekTables] Failed to check table post:",
      error,
    );
    return null;
  }

  return data as TrackedPost | null;
}

async function deleteTrackedPost(
  trackingId: string,
): Promise<void> {
  const { error } =
    await supabase
      .from(
        "gameweek_table_posts",
      )
      .delete()
      .eq("id", trackingId);

  if (error) {
    console.error(
      "[GameweekTables] Failed to delete stale tracking row:",
      error,
    );
  }
}

async function isTrackedPostHealthy(
  client: Client,
  trackedPost: TrackedPost,
): Promise<boolean> {
  try {
    const channel =
      await client.channels.fetch(
        trackedPost.channel_id,
      );

    if (!channel) {
      return false;
    }

    if (
      channel.type !==
        ChannelType.GuildText &&
      channel.type !==
        ChannelType.GuildAnnouncement
    ) {
      return false;
    }

    const message =
      await channel.messages.fetch(
        trackedPost.message_id,
      );

    if (!message) {
      return false;
    }

    const attachment =
      message.attachments.find(
        (item) =>
          item.contentType?.startsWith(
            "image/",
          ) ||
          /\.(png|jpe?g|webp)$/i.test(
            item.name ?? "",
          ),
      );

    return Boolean(attachment);
  } catch {
    return false;
  }
}

async function postTable(
  client: Client,
  division: Division,
  rows: TableRow[],
  cycleStartedAt: string,
  gameweekNumber: number,
): Promise<void> {
  console.log(
    `[GameweekTables] Starting table process for ${division.league_id} • ${division.name} • GW${gameweekNumber}...`,
  );

  const existing =
    await getTablePost(
      division.id,
      cycleStartedAt,
      gameweekNumber,
    );

  if (existing) {
    const healthy =
      await isTrackedPostHealthy(
        client,
        existing,
      );

    if (healthy) {
      console.log(
        `[GameweekTables] GW${gameweekNumber} already has a healthy table post. Skipping.`,
      );
      return;
    }

    console.log(
      `[GameweekTables] Existing GW${gameweekNumber} post is stale. Regenerating.`,
    );

    await deleteTrackedPost(
      existing.id,
    );
  }

  const guildSettings =
    await getGuildSettings(
      division.league_id,
    );

  if (!guildSettings?.guild_id) {
    console.log(
      "[GameweekTables] No connected Discord guild.",
    );
    return;
  }

  const channelSettings =
    await getChannelSettings(
      division.league_id,
    );

  if (
    !channelSettings?.table_channel_id
  ) {
    console.log(
      "[GameweekTables] No table channel configured.",
    );
    return;
  }

  const guild =
    await client.guilds.fetch(
      guildSettings.guild_id,
    );

  const channel =
    await guild.channels.fetch(
      channelSettings.table_channel_id,
    );

  if (!channel) {
    return;
  }

  if (
    channel.type !==
      ChannelType.GuildText &&
    channel.type !==
      ChannelType.GuildAnnouncement
  ) {
    console.log(
      "[GameweekTables] Table channel is not a text channel.",
    );
    return;
  }

  if (rows.length === 0) {
    console.log(
      "[GameweekTables] No teams found.",
    );
    return;
  }

  const png =
    await generateTablePng(
      division,
      rows,
    );

  const safeName =
    division.name
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-|-$/g,
        "",
      );

  const attachment =
    new AttachmentBuilder(
      png,
      {
        name: `nova-${safeName}-gw${gameweekNumber}.png`,
      },
    );

  const message =
    await channel.send({
      content:
        `📊 **${division.name} • Gameweek ${gameweekNumber} Table**`,
      files: [
        attachment,
      ],
    });

  console.log(
    `[GameweekTables] Posted GW${gameweekNumber} table as message ${message.id}.`,
  );

  const { error } =
    await supabase
      .from(
        "gameweek_table_posts",
      )
      .insert({
        division_id:
          division.id,
        cycle_started_at:
          cycleStartedAt,
        gameweek_number:
          gameweekNumber,
        channel_id:
          channel.id,
        message_id:
          message.id,
      });

  if (error) {
    console.error(
      "[GameweekTables] Failed to save table tracking:",
      error,
    );

    try {
      await message.delete();
    } catch {}
  } else {
    console.log(
      "[GameweekTables] Table tracking saved successfully.",
    );
  }
}

async function gameweekIsComplete(
  divisionId: string,
  gameweekNumber: number,
): Promise<boolean> {
  console.log(
    `[GameweekTables] Checking completion for division ${divisionId} GW${gameweekNumber}...`,
  );

  const { data, error } =
    await supabase
      .from("fixtures")
      .select(
        "id, home_score, away_score, status",
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
      `[GameweekTables] Failed to load fixtures for GW${gameweekNumber}:`,
      error,
    );
    return false;
  }

  const fixtures =
    data ?? [];

  if (fixtures.length === 0) {
    console.log(
      `[GameweekTables] GW${gameweekNumber} has no fixtures.`,
    );
    return false;
  }

  const complete =
    fixtures.every(
      (fixture) =>
        fixture.home_score !== null &&
        fixture.away_score !== null,
    );

  console.log(
    `[GameweekTables] GW${gameweekNumber}: ${fixtures.length} fixture(s) | complete: ${complete}`,
  );

  return complete;
}

async function checkDivision(
  client: Client,
  division: Division,
): Promise<void> {
  if (!division.start_date) {
    console.log(
      `[GameweekTables] Division "${division.name}" has no start date.`,
    );
    return;
  }

  const cycleStartedAt =
    division.start_date;

  console.log(
    `[GameweekTables] Checking division "${division.name}" (${division.id})...`,
  );

  const teams =
    await getTeams(
      division.id,
    );

  const standings =
    await getStandings(
      division.id,
    );

  const rows =
    buildTable(
      teams,
      standings,
    );

  console.log(
    `[GameweekTables] Built table with ${rows.length} row(s).`,
  );

  /*
   * GW0 always exists as the initial table.
   */
  await postTable(
    client,
    division,
    rows,
    cycleStartedAt,
    0,
  );

  const {
    data: gameweeks,
    error,
  } = await supabase
    .from("gameweeks")
    .select("id, number")
    .eq(
      "division_id",
      division.id,
    )
    .order(
      "number",
      {
        ascending: true,
      },
    );

  if (error) {
    console.error(
      "[GameweekTables] Failed to load gameweeks:",
      error,
    );
    return;
  }

  if (
    !gameweeks ||
    gameweeks.length === 0
  ) {
    console.log(
      `[GameweekTables] No later gameweeks exist for "${division.name}".`,
    );
    return;
  }

  for (const gameweek of gameweeks) {
    const gameweekNumber =
      Number(gameweek.number);

    if (
      !Number.isFinite(
        gameweekNumber,
      ) ||
      gameweekNumber < 1
    ) {
      continue;
    }

    const existing =
      await getTablePost(
        division.id,
        cycleStartedAt,
        gameweekNumber,
      );

    if (existing) {
      const healthy =
        await isTrackedPostHealthy(
          client,
          existing,
        );

      if (healthy) {
        console.log(
          `[GameweekTables] GW${gameweekNumber} already has a healthy table post. Skipping.`,
        );
        continue;
      }

      await deleteTrackedPost(
        existing.id,
      );
    }

    const complete =
      await gameweekIsComplete(
        division.id,
        gameweekNumber,
      );

    if (!complete) {
      console.log(
        `[GameweekTables] GW${gameweekNumber} is not complete yet.`,
      );

      break;
    }

    const updatedStandings =
      await getStandings(
        division.id,
      );

    const updatedRows =
      buildTable(
        teams,
        updatedStandings,
      );

    await postTable(
      client,
      division,
      updatedRows,
      cycleStartedAt,
      gameweekNumber,
    );
  }
}

async function checkGameweekTables(
  client: Client,
): Promise<void> {
  console.log(
    "[GameweekTables] Starting automatic table check...",
  );

  const {
    data: divisions,
    error,
  } = await supabase
    .from("divisions")
    .select(
      "id, league_id, name, status, start_date",
    )
    .eq(
      "status",
      "active",
    );

  if (error) {
    console.error(
      "[GameweekTables] Failed to load active divisions:",
      error,
    );
    return;
  }

  const activeDivisions =
    (divisions ?? []) as Division[];

  console.log(
    `[GameweekTables] Found ${activeDivisions.length} active division(s).`,
  );

  for (const division of activeDivisions) {
    try {
      await checkDivision(
        client,
        division,
      );
    } catch (error) {
      console.error(
        `[GameweekTables] Error checking division "${division.name}":`,
        error,
      );
    }
  }

  console.log(
    "[GameweekTables] Automatic table check finished.",
  );
}

export function startGameweekTableWatcher(
  client: Client,
): void {
  console.log(
    "[GameweekTables] NOVA automatic Gameweek table watcher started.",
  );

  const run = async () => {
    try {
      await checkGameweekTables(
        client,
      );
    } catch (error) {
      console.error(
        "[GameweekTables] Watcher error:",
        error,
      );
    }
  };

  void run();

  setInterval(
    () => {
      void run();
    },
    30_000,
  );
}
