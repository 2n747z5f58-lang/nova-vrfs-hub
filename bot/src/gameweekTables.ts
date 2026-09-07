import {
  AttachmentBuilder,
  ChannelType,
  Client,
} from "discord.js";
import { Resvg } from "@resvg/resvg-js";
import { existsSync } from "node:fs";
import { join } from "node:path";
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
};
type ChannelSettings = {
  table_channel_id: string | null;
};
/*
 * NOVA TABLE FONT
 *
 * Expected location:
 *
 * bot/fonts/DejaVuSans.ttf
 *
 * Railway runs the application from the project root,
 * so process.cwd() is used instead of relying on the
 * compiled JS file location.
 */
const FONT_FAMILY = "DejaVu Sans";
const FONT_CANDIDATES = [
  join(
    process.cwd(),
    "bot",
    "fonts",
    "DejaVuSans.ttf",
  ),
  join(
    process.cwd(),
    "fonts",
    "DejaVuSans.ttf",
  ),
];
const FOUND_FONT_PATH =
  FONT_CANDIDATES.find((path) =>
    existsSync(path),
  );
if (!FOUND_FONT_PATH) {
  throw new Error(
    [
      "[GameweekTables] DejaVuSans.ttf was not found.",
      "Expected one of:",
      ...FONT_CANDIDATES.map(
        (path) => `  ${path}`,
      ),
    ].join("\n"),
  );
}
/*
 * After the existence check TypeScript still considers
 * FOUND_FONT_PATH potentially undefined, so we create a
 * guaranteed string value here.
 */
const FONT_PATH: string = FOUND_FONT_PATH;
console.log(
  `[GameweekTables] Font loaded from: ${FONT_PATH}`,
);
async function getGuildSettings(
  leagueId: string,
): Promise<GuildSettings | null> {
  console.log(
    `[GameweekTables] Loading Discord guild settings for league ${leagueId}...`,
  );
  const { data, error } = await supabase
    .from("guild_settings")
    .select("guild_id")
    .eq("league_id", leagueId)
    .maybeSingle();
  if (error) {
    console.error(
      `[GameweekTables] Failed to load guild settings:`,
      error,
    );
    return null;
  }
  if (!data) {
    console.log(
      `[GameweekTables] No Discord guild is connected to league ${leagueId}.`,
    );
    return null;
  }
  console.log(
    `[GameweekTables] Guild connected: ${data.guild_id}`,
  );
  return data;
}
async function getChannelSettings(
  leagueId: string,
): Promise<ChannelSettings | null> {
  console.log(
    `[GameweekTables] Loading table channel for league ${leagueId}...`,
  );
  const { data, error } = await supabase
    .from("league_channel_settings")
    .select("table_channel_id")
    .eq("league_id", leagueId)
    .maybeSingle();
  if (error) {
    console.error(
      `[GameweekTables] Failed to load league channel settings:`,
      error,
    );
    return null;
  }
  if (!data) {
    console.log(
      `[GameweekTables] No channel settings found for league ${leagueId}.`,
    );
    return null;
  }
  console.log(
    `[GameweekTables] Table channel configured: ${data.table_channel_id}`,
  );
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
      `[GameweekTables] Failed to load teams:`,
      error,
    );
    return [];
  }
  const teams =
    (data ?? []) as Team[];
  console.log(
    `[GameweekTables] Found ${teams.length} team(s).`,
  );
  for (const team of teams) {
    console.log(
      `[GameweekTables] Team: "${team.name}" (${team.id}) | logo: ${
        team.logo_url
          ? "yes"
          : "no"
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
    .eq(
      "division_id",
      divisionId,
    );
  if (error) {
    console.error(
      `[GameweekTables] Failed to load standings:`,
      error,
    );
    return [];
  }
  const standings =
    (data ?? []) as Standing[];
  console.log(
    `[GameweekTables] Found ${standings.length} standing row(s).`,
  );
  return standings;
}
function buildTable(
  teams: Team[],
  standings: Standing[],
): TableRow[] {
  const standingMap =
    new Map<string, Standing>();
  for (const standing of standings) {
    standingMap.set(
      standing.team_id,
      {
        team_id:
          standing.team_id,
        played: Number(
          standing.played ?? 0,
        ),
        won: Number(
          standing.won ?? 0,
        ),
        drawn: Number(
          standing.drawn ?? 0,
        ),
        lost: Number(
          standing.lost ?? 0,
        ),
        goals_for: Number(
          standing.goals_for ?? 0,
        ),
        goals_against:
          Number(
            standing.goals_against ??
              0,
          ),
        goal_difference:
          Number(
            standing.goal_difference ??
              0,
          ),
        points: Number(
          standing.points ?? 0,
        ),
      },
    );
  }
  const rows: TableRow[] =
    teams.map((team) => {
      const existing =
        standingMap.get(
          team.id,
        );
      return {
        position: 0,
        team,
        standing:
          existing ??
          {
            team_id:
              team.id,
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
  rows.forEach(
    (row, index) => {
      row.position =
        index + 1;
    },
  );
  return rows;
}
function escapeXml(
  value: string,
): string {
  return value
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&apos;",
    );
}
function truncateText(
  value: string,
  maxLength: number,
): string {
  if (
    value.length <=
    maxLength
  ) {
    return value;
  }
  return `${value.slice(
    0,
    Math.max(
      0,
      maxLength - 3,
    ),
  )}...`;
}
async function downloadLogoAsDataUri(
  logoUrl: string,
): Promise<string | null> {
  try {
    const controller =
      new AbortController();
    const timeout =
      setTimeout(() => {
        controller.abort();
      }, 8000);
    const response =
      await fetch(logoUrl, {
        signal:
          controller.signal,
      });
    clearTimeout(timeout);
    if (!response.ok) {
      console.log(
        `[GameweekTables] Logo request failed with status ${response.status}.`,
      );
      return null;
    }
    const contentType =
      response.headers.get(
        "content-type",
      ) ?? "";
    if (
      !contentType.startsWith(
        "image/",
      )
    ) {
      console.log(
        `[GameweekTables] Logo URL did not return an image: ${contentType}`,
      );
      return null;
    }
    const buffer =
      Buffer.from(
        await response.arrayBuffer(),
      );
    if (!buffer.length) {
      return null;
    }
    return `data:${contentType};base64,${buffer.toString(
      "base64",
    )}`;
  } catch (error) {
    console.error(
      `[GameweekTables] Failed to download team logo:`,
      error,
    );
    return null;
  }
}
async function createLogoMarkup(
  team: Team,
  x: number,
  y: number,
  size: number,
): Promise<string> {
  const radius =
    size / 2;
  if (team.logo_url) {
    const logoDataUri =
      await downloadLogoAsDataUri(
        team.logo_url,
      );
    if (logoDataUri) {
      return `
        <clipPath id="clip-${escapeXml(
          team.id,
        )}">
          <circle
            cx="${x + radius}"
            cy="${y + radius}"
            r="${radius}"
          />
        </clipPath>
        <image
          href="${logoDataUri}"
          x="${x}"
          y="${y}"
          width="${size}"
          height="${size}"
          preserveAspectRatio="xMidYMid slice"
          clip-path="url(#clip-${escapeXml(
            team.id,
          )})"
        />
      `;
    }
  }
  const initials =
    team.name
      .split(/\s+/)
      .filter(Boolean)
      .map(
        (part) =>
          part[0],
      )
      .join("")
      .slice(0, 2)
      .toUpperCase();
  return `
    <circle
      cx="${x + radius}"
      cy="${y + radius}"
      r="${radius}"
      fill="#222222"
    />
    <text
      x="${x + radius}"
      y="${y + radius + 8}"
      text-anchor="middle"
      font-family="${FONT_FAMILY}"
      font-size="24"
      font-weight="700"
      fill="#ffffff"
    >${escapeXml(
      initials || "?",
    )}</text>
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
  const bottomHeight = 70;
  const left = 50;
  const right = 50;
  const tableWidth =
    width -
    left -
    right;
  /*
   * # | TEAM | P | W | D | L | GF | GA | GD | PTS
   */
  const positionWidth = 80;
  const teamWidth = 560;
  const statWidth = 90;
  const goalDiffWidth = 105;
  const pointsWidth = 120;
  const finalTeamWidth =
    tableWidth -
    positionWidth -
    statWidth * 6 -
    goalDiffWidth -
    pointsWidth;
  /*
   * Safety fallback so the team column cannot become tiny.
   */
  const actualTeamWidth =
    Math.max(
      teamWidth,
      finalTeamWidth,
    );
  const headerY =
    topHeight;
  const bodyY =
    topHeight +
    headerHeight;
  const totalHeight =
    topHeight +
    headerHeight +
    rows.length *
      rowHeight +
    bottomHeight;
  const title =
    escapeXml(
      division.name,
    );
  let svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${width}"
      height="${totalHeight}"
      viewBox="0 0 ${width} ${totalHeight}"
    >
      <rect
        x="0"
        y="0"
        width="${width}"
        height="${totalHeight}"
        fill="#000000"
      />
      <!-- NOVA -->
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
      >${title}</text>
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
        fill="#777777"
      >VRFS • NOVA</text>
      <!-- HEADER -->
      <rect
        x="${left}"
        y="${headerY}"
        width="${tableWidth}"
        height="${headerHeight}"
        rx="12"
        fill="#151515"
      />
  `;
  const teamStart =
    left +
    positionWidth;
  const statStart =
    teamStart +
    actualTeamWidth;
  const columns = [
    {
      label: "#",
      x: left,
      width: positionWidth,
      align: "middle",
    },
    {
      label: "TEAM",
      x: teamStart,
      width: actualTeamWidth,
      align: "start",
    },
    {
      label: "P",
      x: statStart,
      width: statWidth,
      align: "middle",
    },
    {
      label: "W",
      x:
        statStart +
        statWidth,
      width: statWidth,
      align: "middle",
    },
    {
      label: "D",
      x:
        statStart +
        statWidth * 2,
      width: statWidth,
      align: "middle",
    },
    {
      label: "L",
      x:
        statStart +
        statWidth * 3,
      width: statWidth,
      align: "middle",
    },
    {
      label: "GF",
      x:
        statStart +
        statWidth * 4,
      width: statWidth,
      align: "middle",
    },
    {
      label: "GA",
      x:
        statStart +
        statWidth * 5,
      width: statWidth,
      align: "middle",
    },
    {
      label: "GD",
      x:
        statStart +
        statWidth * 6,
      width: goalDiffWidth,
      align: "middle",
    },
    {
      label: "PTS",
      x:
        statStart +
        statWidth * 6 +
        goalDiffWidth,
      width: pointsWidth,
      align: "middle",
    },
  ];
  for (
    const column of columns
  ) {
    const textX =
      column.align ===
      "start"
        ? column.x + 28
        : column.x +
          column.width / 2;
    svg += `
      <text
        x="${textX}"
        y="${headerY + 51}"
        ${
          column.align ===
          "start"
            ? ""
            : `text-anchor="middle"`
        }
        font-family="${FONT_FAMILY}"
        font-size="21"
        font-weight="700"
        fill="#888888"
      >${column.label}</text>
    `;
  }
  /*
   * ROWS
   */
  for (
    let index = 0;
    index < rows.length;
    index++
  ) {
    const row =
      rows[index];
    const y =
      bodyY +
      index *
        rowHeight;
    const centerY =
      y +
      rowHeight / 2;
    const background =
      index % 2 === 0
        ? "#0c0c0c"
        : "#111111";
    svg += `
      <rect
        x="${left}"
        y="${y}"
        width="${tableWidth}"
        height="${rowHeight}"
        fill="${background}"
      />
      <!-- POSITION -->
      <text
        x="${left + positionWidth / 2}"
        y="${centerY + 9}"
        text-anchor="middle"
        font-family="${FONT_FAMILY}"
        font-size="25"
        font-weight="700"
        fill="#ffffff"
      >${row.position}</text>
    `;
    /*
     * LOGO
     */
    const logoSize =
      58;
    const logoX =
      teamStart +
      20;
    const logoY =
      centerY -
      logoSize / 2;
    svg +=
      await createLogoMarkup(
        row.team,
        logoX,
        logoY,
        logoSize,
      );
    /*
     * TEAM NAME
     */
    const teamTextX =
      logoX +
      logoSize +
      20;
    svg += `
      <text
        x="${teamTextX}"
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
    `;
    /*
     * P / W / D / L / GF / GA
     */
    const values = [
      row.standing.played,
      row.standing.won,
      row.standing.drawn,
      row.standing.lost,
      row.standing.goals_for,
      row.standing.goals_against,
    ];
    values.forEach(
      (
        value,
        statIndex,
      ) => {
        const x =
          statStart +
          statWidth *
            statIndex +
          statWidth / 2;
        svg += `
          <text
            x="${x}"
            y="${centerY + 8}"
            text-anchor="middle"
            font-family="${FONT_FAMILY}"
            font-size="24"
            font-weight="600"
            fill="#dddddd"
          >${value}</text>
        `;
      },
    );
    /*
     * GD
     */
    const gdX =
      statStart +
      statWidth * 6 +
      goalDiffWidth / 2;
    const gd =
      row.standing
        .goal_difference;
    svg += `
      <text
        x="${gdX}"
        y="${centerY + 8}"
        text-anchor="middle"
        font-family="${FONT_FAMILY}"
        font-size="24"
        font-weight="600"
        fill="#dddddd"
      >${
        gd > 0
          ? "+"
          : ""
      }${gd}</text>
    `;
    /*
     * PTS
     */
    const pointsX =
      statStart +
      statWidth * 6 +
      goalDiffWidth +
      pointsWidth / 2;
    svg += `
      <text
        x="${pointsX}"
        y="${centerY + 8}"
        text-anchor="middle"
        font-family="${FONT_FAMILY}"
        font-size="27"
        font-weight="800"
        fill="#ffffff"
      >${row.standing.points}</text>
    `;
    /*
     * DIVIDER
     */
    svg += `
      <line
        x1="${left}"
        y1="${y + rowHeight - 1}"
        x2="${left + tableWidth}"
        y2="${y + rowHeight - 1}"
        stroke="#222222"
        stroke-width="1"
      />
    `;
  }
  /*
   * FOOTER
   */
  const footerY =
    topHeight +
    headerHeight +
    rows.length *
      rowHeight;
  svg += `
      <text
        x="${left}"
        y="${footerY + 44}"
        font-family="${FONT_FAMILY}"
        font-size="17"
        fill="#666666"
      >Generated automatically by NOVA</text>
      <text
        x="${width - right}"
        y="${footerY + 44}"
        text-anchor="end"
        font-family="${FONT_FAMILY}"
        font-size="17"
        fill="#666666"
      >${rows.length} TEAM${
    rows.length === 1
      ? ""
      : "S"
  }</text>
    </svg>
  `;
  return svg;
}
async function generateTablePng(
  division: Division,
  rows: TableRow[],
): Promise<Buffer> {
  console.log(
    `[GameweekTables] Generating PNG for ${division.name}...`,
  );
  console.log(
    `[GameweekTables] Using bundled font: ${FONT_PATH}`,
  );
  const svg =
    await buildTableSvg(
      division,
      rows,
    );
  /*
   * Resvg gets the bundled DejaVu font explicitly.
   */
  const resvg =
    new Resvg(
      svg,
      {
        font: {
          fontFiles: [
            FONT_PATH,
          ],
          loadSystemFonts:
            false,
          defaultFontFamily:
            FONT_FAMILY,
          sansSerifFamily:
            FONT_FAMILY,
          serifFamily:
            FONT_FAMILY,
          monospaceFamily:
            FONT_FAMILY,
        },
        textRendering: 1,
        shapeRendering: 2,
      },
    );
  const pngData =
    resvg.render();
  const pngBuffer =
    Buffer.from(
      pngData.asPng(),
    );
  /*
   * @resvg/resvg-js versions differ.
   * The installed version does not expose .free(),
   * so we intentionally do not call it.
   */
  if (
    pngBuffer.length < 8 ||
    pngBuffer[0] !==
      0x89 ||
    pngBuffer[1] !==
      0x50 ||
    pngBuffer[2] !==
      0x4e ||
    pngBuffer[3] !==
      0x47
  ) {
    throw new Error(
      "Generated table is not a valid PNG.",
    );
  }
  console.log(
    `[GameweekTables] Generated PNG successfully.`,
  );
  return pngBuffer;
}
async function getTablePost(
  divisionId: string,
  cycleStartedAt: string,
  gameweekNumber: number,
) {
  const { data, error } =
    await supabase
      .from(
        "gameweek_table_posts",
      )
      .select(
        "id, division_id, cycle_started_at, gameweek_number, channel_id, message_id",
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
      `[GameweekTables] Failed to check table post tracking:`,
      error,
    );
    return null;
  }
  return data;
}
async function deleteTrackedPost(
  trackingId: string,
): Promise<void> {
  console.log(
    `[GameweekTables] Removing stale table tracking row ${trackingId}...`,
  );
  const { error } =
    await supabase
      .from(
        "gameweek_table_posts",
      )
      .delete()
      .eq(
        "id",
        trackingId,
      );
  if (error) {
    console.error(
      `[GameweekTables] Failed to remove stale tracking row:`,
      error,
    );
  }
}
async function isTrackedPostHealthy(
  client: Client,
  trackedPost: {
    id: string;
    channel_id: string;
    message_id: string;
  },
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
    const imageAttachment =
      message.attachments.find(
        (attachment) =>
          attachment.contentType?.startsWith(
            "image/",
          ) ||
          /\.(png|jpe?g|webp)$/i.test(
            attachment.name ??
              "",
          ),
      );
    if (!imageAttachment) {
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      `[GameweekTables] Failed to validate existing table post:`,
      error,
    );
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
  const existingPost =
    await getTablePost(
      division.id,
      cycleStartedAt,
      gameweekNumber,
    );
  if (existingPost) {
    console.log(
      `[GameweekTables] Validating existing GW${gameweekNumber} table post ${existingPost.message_id}...`,
    );
    const healthy =
      await isTrackedPostHealthy(
        client,
        existingPost,
      );
    if (healthy) {
      console.log(
        `[GameweekTables] GW${gameweekNumber} already has a healthy table post. Skipping.`,
      );
      return;
    }
    console.log(
      `[GameweekTables] Existing GW${gameweekNumber} table post is stale. Regenerating.`,
    );
    await deleteTrackedPost(
      existingPost.id,
    );
  }
  const guildSettings =
    await getGuildSettings(
      division.league_id,
    );
  if (
    !guildSettings?.guild_id
  ) {
    console.log(
      `[GameweekTables] Cannot post GW${gameweekNumber}: no connected Discord guild.`,
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
      `[GameweekTables] Cannot post GW${gameweekNumber}: no table channel configured.`,
    );
    return;
  }
  const guild =
    await client.guilds.fetch(
      guildSettings.guild_id,
    );
  if (!guild) {
    return;
  }
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
      `[GameweekTables] Configured table channel is not a text/announcement channel.`,
    );
    return;
  }
  if (rows.length === 0) {
    console.log(
      `[GameweekTables] No teams exist in ${division.name}; table will not be posted.`,
    );
    return;
  }
  const pngBuffer =
    await generateTablePng(
      division,
      rows,
    );
  const safeDivisionName =
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
      pngBuffer,
      {
        name: `nova-${safeDivisionName}-gw${gameweekNumber}.png`,
      },
    );
  const message =
    await channel.send({
      content: `📊 **${division.name} — Gameweek ${gameweekNumber} Table**`,
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
      `[GameweekTables] Failed to save table post tracking:`,
      error,
    );
    try {
      await message.delete();
      console.log(
        `[GameweekTables] Deleted untracked Discord table message ${message.id}.`,
      );
    } catch (deleteError) {
      console.error(
        `[GameweekTables] Failed to delete untracked table message:`,
        deleteError,
      );
    }
    return;
  }
  console.log(
    `[GameweekTables] GW${gameweekNumber} table tracking saved successfully.`,
  );
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
        "id, home_score, away_score",
      )
      .eq(
        "division_id",
        divisionId,
      )
      .eq(
        "gameweek_number",
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
  if (
    fixtures.length ===
    0
  ) {
    console.log(
      `[GameweekTables] GW${gameweekNumber} has no fixtures.`,
    );
    return false;
  }
  const complete =
    fixtures.every(
      (fixture) =>
        fixture.home_score !==
          null &&
        fixture.away_score !==
          null,
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
      `[GameweekTables] Division "${division.name}" has no start date. Skipping.`,
    );
    return;
  }
  const cycleStartedAt =
    division.start_date;
  console.log(
    `[GameweekTables] Checking division "${division.name}" (${division.id})...`,
  );
  console.log(
    `[GameweekTables] Current season cycle: ${cycleStartedAt}`,
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
   * GW0 starting table.
   */
  await postTable(
    client,
    division,
    rows,
    cycleStartedAt,
    0,
  );
  console.log(
    `[GameweekTables] Loading gameweeks for "${division.name}"...`,
  );
  const {
    data: gameweeks,
    error,
  } = await supabase
    .from("gameweeks")
    .select(
      "id, gameweek_number",
    )
    .eq(
      "division_id",
      division.id,
    )
    .order(
      "gameweek_number",
      {
        ascending: true,
      },
    );
  if (error) {
    console.error(
      `[GameweekTables] Failed to load gameweeks:`,
      error,
    );
    return;
  }
  if (
    !gameweeks ||
    gameweeks.length ===
      0
  ) {
    console.log(
      `[GameweekTables] No later gameweeks exist for "${division.name}" yet.`,
    );
    return;
  }
  for (
    const gameweek of gameweeks
  ) {
    const gameweekNumber =
      Number(
        gameweek.gameweek_number,
      );
    if (
      gameweekNumber <
      1
    ) {
      continue;
    }
    const existingPost =
      await getTablePost(
        division.id,
        cycleStartedAt,
        gameweekNumber,
      );
    if (existingPost) {
      const healthy =
        await isTrackedPostHealthy(
          client,
          existingPost,
        );
      if (healthy) {
        console.log(
          `[GameweekTables] GW${gameweekNumber} already has a healthy table post. Skipping.`,
        );
        continue;
      }
      await deleteTrackedPost(
        existingPost.id,
      );
    }
    const complete =
      await gameweekIsComplete(
        division.id,
        gameweekNumber,
      );
    if (!complete) {
      console.log(
        `[GameweekTables] GW${gameweekNumber} is not complete yet. Stopping later-GW checks.`,
      );
      break;
    }
    console.log(
      `[GameweekTables] GW${gameweekNumber} is complete. Posting updated table...`,
    );
    await postTable(
      client,
      division,
      rows,
      cycleStartedAt,
      gameweekNumber,
    );
  }
}
async function checkGameweekTables(
  client: Client,
): Promise<void> {
  console.log(
    `[GameweekTables] Starting automatic table check...`,
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
      `[GameweekTables] Failed to load active divisions:`,
      error,
    );
    return;
  }
  const activeDivisions =
    (divisions ?? []) as Division[];
  console.log(
    `[GameweekTables] Found ${activeDivisions.length} active division(s).`,
  );
  if (
    activeDivisions.length ===
    0
  ) {
    return;
  }
  for (
    const division of activeDivisions
  ) {
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
    `[GameweekTables] Automatic table check finished.`,
  );
}
export function startGameweekTableWatcher(
  client: Client,
): void {
  console.log(
    `[GameweekTables] NOVA automatic Gameweek table watcher started.`,
  );
  const runCheck =
    async () => {
      try {
        await checkGameweekTables(
          client,
        );
      } catch (error) {
        console.error(
          `[GameweekTables] Unhandled watcher error:`,
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
