import {
  AttachmentBuilder,
  ChannelType,
  Client,
} from "discord.js";
import {
  createCanvas,
  loadImage,
  registerFont,
  type Image,
} from "canvas";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { supabase } from "./database.js";

type Division = {
  id: string;
  league_id: string;
  name: string;
  tier: number;
  season: string | null;
  status: string;
  gameweek_interval_days: number;
};

type Team = {
  id: string;
  name: string;
  logo_url: string | null;
  division_id: string;
};

type Standing = {
  team_id: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
};

type TableRow = {
  position: number;
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type TrackedPost = {
  id: string;
  division_id: string;
  gameweek: number;
  channel_id: string;
  message_id: string;
};

const WIDTH = 1600;

const TOP_HEIGHT = 190;
const HEADER_HEIGHT = 80;
const ROW_HEIGHT = 100;
const FOOTER_HEIGHT = 70;

const LEFT = 50;
const RIGHT = 50;

const TABLE_WIDTH = WIDTH - LEFT - RIGHT;

const POSITION_WIDTH = 80;
const TEAM_WIDTH = 655;

const STAT_WIDTH = 90;
const GOAL_DIFF_WIDTH = 105;
const POINTS_WIDTH = 120;

const BODY_START_Y = TOP_HEIGHT + HEADER_HEIGHT;

const FONT_FAMILY = "DejaVu Sans";

const FONT_CANDIDATES = [
  join(
    dirname(__dirname),
    "assets",
    "fonts",
    "DejaVuSans.ttf",
  ),
  join(
    dirname(__dirname),
    "fonts",
    "DejaVuSans.ttf",
  ),
  join(
    process.cwd(),
    "assets",
    "fonts",
    "DejaVuSans.ttf",
  ),
  join(
    process.cwd(),
    "fonts",
    "DejaVuSans.ttf",
  ),
];

let registeredFont = false;

for (const fontPath of FONT_CANDIDATES) {
  if (!existsSync(fontPath)) {
    continue;
  }

  try {
    registerFont(fontPath, {
      family: FONT_FAMILY,
      weight: "normal",
      style: "normal",
    });

    registeredFont = true;

    console.log(
      `[TABLES] Registered font: ${fontPath}`,
    );

    break;
  } catch (error) {
    console.error(
      `[TABLES] Failed to register font ${fontPath}:`,
      error,
    );
  }
}

if (!registeredFont) {
  console.warn(
    "[TABLES] DejaVuSans.ttf not found. Using system font fallback.",
  );
}

function truncateText(
  text: string,
  maxLength: number,
): string {
  const value = String(text ?? "");

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function getFont(
  size: number,
  weight: "normal" | "bold" = "normal",
): string {
  return `${weight} ${size}px "${FONT_FAMILY}"`;
}

function roundedRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(
    radius,
    width / 2,
    height / 2,
  );

  ctx.beginPath();

  ctx.moveTo(x + r, y);

  ctx.lineTo(
    x + width - r,
    y,
  );

  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + r,
  );

  ctx.lineTo(
    x + width,
    y + height - r,
  );

  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height,
  );

  ctx.lineTo(
    x + r,
    y + height,
  );

  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - r,
  );

  ctx.lineTo(
    x,
    y + r,
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y,
  );

  ctx.closePath();
}

function drawText(
  ctx: any,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight: "normal" | "bold" = "normal",
  align:
    | "left"
    | "center"
    | "right" = "left",
) {
  ctx.font = getFont(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  ctx.fillText(
    text,
    x,
    y,
  );
}

async function getGuildSettings(
  guildId: string,
) {
  const { data, error } = await supabase
    .from("league_channel_settings")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (error) {
    console.error(
      "[TABLES] Failed to load guild settings:",
      error,
    );
  }

  return data;
}

async function getChannelSettings(
  guildId: string,
  divisionId: string,
) {
  const { data, error } = await supabase
    .from("division_channel_settings")
    .select("*")
    .eq("guild_id", guildId)
    .eq("division_id", divisionId)
    .maybeSingle();

  if (error) {
    console.error(
      "[TABLES] Failed to load division channel settings:",
      error,
    );
  }

  return data;
}

async function getTeams(
  divisionId: string,
): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select(
      "id,name,logo_url,division_id",
    )
    .eq("division_id", divisionId)
    .order("name", {
      ascending: true,
    });

  if (error) {
    console.error(
      "[TABLES] Failed to load teams:",
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
      [
        "team_id",
        "played",
        "wins",
        "draws",
        "losses",
        "goals_for",
        "goals_against",
        "goal_difference",
        "points",
      ].join(","),
    )
    .eq("division_id", divisionId);

  if (error) {
    console.error(
      "[TABLES] Failed to load standings:",
      error,
    );

    return [];
  }

  return (data ?? []) as Standing[];
}

function buildTable(
  teams: Team[],
  standings: Standing[],
): TableRow[] {
  const standingsByTeam = new Map<
    string,
    Standing
  >();

  for (const standing of standings) {
    standingsByTeam.set(
      standing.team_id,
      standing,
    );
  }

  const rows = teams.map((team) => {
    const standing =
      standingsByTeam.get(team.id);

    return {
      position: 0,
      team,
      played: standing?.played ?? 0,
      wins: standing?.wins ?? 0,
      draws: standing?.draws ?? 0,
      losses: standing?.losses ?? 0,
      goalsFor:
        standing?.goals_for ?? 0,
      goalsAgainst:
        standing?.goals_against ?? 0,
      goalDifference:
        standing?.goal_difference ?? 0,
      points: standing?.points ?? 0,
    };
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (
      b.goalDifference !==
      a.goalDifference
    ) {
      return (
        b.goalDifference -
        a.goalDifference
      );
    }

    if (b.goalsFor !== a.goalsFor) {
      return b.goalsFor - a.goalsFor;
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

async function downloadLogo(
  logoUrl: string | null,
): Promise<Image | null> {
  if (!logoUrl) {
    return null;
  }

  try {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      8000,
    );

    const response = await fetch(
      logoUrl,
      {
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(
        `[TABLES] Logo request failed: ${response.status}`,
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

    return await loadImage(buffer);
  } catch (error) {
    console.warn(
      "[TABLES] Failed to load team logo:",
      error,
    );

    return null;
  }
}

function drawFallbackBadge(
  ctx: any,
  teamName: string,
  x: number,
  y: number,
  size: number,
) {
  const centerX =
    x + size / 2;

  const centerY =
    y + size / 2;

  const radius = size / 2;

  ctx.beginPath();

  ctx.arc(
    centerX,
    centerY,
    radius,
    0,
    Math.PI * 2,
  );

  ctx.fillStyle = "#252525";
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#555555";
  ctx.stroke();

  const initials =
    teamName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase() ?? "",
      )
      .join("") || "?";

  drawText(
    ctx,
    initials,
    centerX,
    centerY,
    Math.max(
      18,
      Math.floor(size * 0.28),
    ),
    "#ffffff",
    "bold",
    "center",
  );
}

function drawLogo(
  ctx: any,
  image: Image | null,
  teamName: string,
  x: number,
  y: number,
  size: number,
) {
  if (!image) {
    drawFallbackBadge(
      ctx,
      teamName,
      x,
      y,
      size,
    );

    return;
  }

  try {
    const naturalWidth =
      image.width ||
      image.naturalWidth ||
      1;

    const naturalHeight =
      image.height ||
      image.naturalHeight ||
      1;

    const scale = Math.min(
      size / naturalWidth,
      size / naturalHeight,
    );

    const drawWidth =
      naturalWidth * scale;

    const drawHeight =
      naturalHeight * scale;

    const drawX =
      x + (size - drawWidth) / 2;

    const drawY =
      y + (size - drawHeight) / 2;

    ctx.imageSmoothingEnabled = true;

    ctx.drawImage(
      image,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );
  } catch (error) {
    console.warn(
      `[TABLES] Failed to draw logo for ${teamName}:`,
      error,
    );

    drawFallbackBadge(
      ctx,
      teamName,
      x,
      y,
      size,
    );
  }
}

async function generateTablePng(
  division: Division,
  rows: TableRow[],
): Promise<Buffer> {
  const height =
    TOP_HEIGHT +
    HEADER_HEIGHT +
    rows.length * ROW_HEIGHT +
    FOOTER_HEIGHT;

  const canvas = createCanvas(
    WIDTH,
    height,
  );

  const ctx =
    canvas.getContext("2d");

  ctx.fillStyle = "#080808";

  ctx.fillRect(
    0,
    0,
    WIDTH,
    height,
  );

  drawText(
    ctx,
    "NOVA",
    LEFT,
    70,
    48,
    "#ffffff",
    "bold",
    "left",
  );

  drawText(
    ctx,
    division.name,
    LEFT,
    125,
    30,
    "#ffffff",
    "bold",
    "left",
  );

  drawText(
    ctx,
    "LEAGUE TABLE",
    WIDTH - RIGHT,
    70,
    22,
    "#aaaaaa",
    "bold",
    "right",
  );

  drawText(
    ctx,
    "VRFS • NOVA",
    WIDTH - RIGHT,
    110,
    18,
    "#666666",
    "normal",
    "right",
  );

  const positionX = LEFT;

  const teamX =
    positionX + POSITION_WIDTH;

  const playedX =
    teamX + TEAM_WIDTH;

  const winsX =
    playedX + STAT_WIDTH;

  const drawsX =
    winsX + STAT_WIDTH;

  const lossesX =
    drawsX + STAT_WIDTH;

  const goalsForX =
    lossesX + STAT_WIDTH;

  const goalsAgainstX =
    goalsForX + STAT_WIDTH;

  const goalDifferenceX =
    goalsAgainstX + STAT_WIDTH;

  const pointsX =
    goalDifferenceX +
    GOAL_DIFF_WIDTH;

  roundedRect(
    ctx,
    LEFT,
    TOP_HEIGHT,
    TABLE_WIDTH,
    HEADER_HEIGHT,
    12,
  );

  ctx.fillStyle = "#171717";
  ctx.fill();

  const headerCenterY =
    TOP_HEIGHT +
    HEADER_HEIGHT / 2;

  drawText(
    ctx,
    "#",
    positionX +
      POSITION_WIDTH / 2,
    headerCenterY,
    22,
    "#aaaaaa",
    "bold",
    "center",
  );

  drawText(
    ctx,
    "TEAM",
    teamX + 20,
    headerCenterY,
    22,
    "#aaaaaa",
    "bold",
    "left",
  );

  const headerColumns = [
    {
      text: "P",
      x:
        playedX +
        STAT_WIDTH / 2,
    },
    {
      text: "W",
      x:
        winsX +
        STAT_WIDTH / 2,
    },
    {
      text: "D",
      x:
        drawsX +
        STAT_WIDTH / 2,
    },
    {
      text: "L",
      x:
        lossesX +
        STAT_WIDTH / 2,
    },
    {
      text: "GF",
      x:
        goalsForX +
        STAT_WIDTH / 2,
    },
    {
      text: "GA",
      x:
        goalsAgainstX +
        STAT_WIDTH / 2,
    },
    {
      text: "GD",
      x:
        goalDifferenceX +
        GOAL_DIFF_WIDTH / 2,
    },
    {
      text: "PTS",
      x:
        pointsX +
        POINTS_WIDTH / 2,
    },
  ];

  for (const column of headerColumns) {
    drawText(
      ctx,
      column.text,
      column.x,
      headerCenterY,
      22,
      "#aaaaaa",
      "bold",
      "center",
    );
  }

  const logoMap = new Map<
    string,
    Image | null
  >();

  await Promise.all(
    rows.map(async (row) => {
      const image =
        await downloadLogo(
          row.team.logo_url,
        );

      logoMap.set(
        row.team.id,
        image,
      );
    }),
  );

  rows.forEach((row, index) => {
    const y =
      BODY_START_Y +
      index * ROW_HEIGHT;

    ctx.fillStyle =
      index % 2 === 0
        ? "#0c0c0c"
        : "#111111";

    ctx.fillRect(
      LEFT,
      y,
      TABLE_WIDTH,
      ROW_HEIGHT,
    );

    ctx.strokeStyle = "#222222";
    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(
      LEFT,
      y + ROW_HEIGHT - 1,
    );

    ctx.lineTo(
      LEFT + TABLE_WIDTH,
      y + ROW_HEIGHT - 1,
    );

    ctx.stroke();

    const centerY =
      y + ROW_HEIGHT / 2;

    drawText(
      ctx,
      String(row.position),
      positionX +
        POSITION_WIDTH / 2,
      centerY,
      24,
      "#dddddd",
      "normal",
      "center",
    );

    const logoSize = 58;

    const logoX =
      teamX + 18;

    const logoY =
      centerY -
      logoSize / 2;

    drawLogo(
      ctx,
      logoMap.get(
        row.team.id,
      ) ?? null,
      row.team.name,
      logoX,
      logoY,
      logoSize,
    );

    drawText(
      ctx,
      truncateText(
        row.team.name,
        30,
      ),
      logoX +
        logoSize +
        20,
      centerY,
      25,
      "#ffffff",
      "bold",
      "left",
    );

    const stats = [
      {
        value: row.played,
        x:
          playedX +
          STAT_WIDTH / 2,
      },
      {
        value: row.wins,
        x:
          winsX +
          STAT_WIDTH / 2,
      },
      {
        value: row.draws,
        x:
          drawsX +
          STAT_WIDTH / 2,
      },
      {
        value: row.losses,
        x:
          lossesX +
          STAT_WIDTH / 2,
      },
      {
        value: row.goalsFor,
        x:
          goalsForX +
          STAT_WIDTH / 2,
      },
      {
        value: row.goalsAgainst,
        x:
          goalsAgainstX +
          STAT_WIDTH / 2,
      },
    ];

    for (const stat of stats) {
      drawText(
        ctx,
        String(stat.value),
        stat.x,
        centerY,
        24,
        "#dddddd",
        "normal",
        "center",
      );
    }

    const gd =
      row.goalDifference > 0
        ? `+${row.goalDifference}`
        : String(
            row.goalDifference,
          );

    drawText(
      ctx,
      gd,
      goalDifferenceX +
        GOAL_DIFF_WIDTH / 2,
      centerY,
      24,
      "#dddddd",
      "normal",
      "center",
    );

    drawText(
      ctx,
      String(row.points),
      pointsX +
        POINTS_WIDTH / 2,
      centerY,
      27,
      "#ffffff",
      "bold",
      "center",
    );
  });

  const footerY =
    BODY_START_Y +
    rows.length * ROW_HEIGHT;

  drawText(
    ctx,
    "Generated automatically by NOVA",
    LEFT,
    footerY +
      FOOTER_HEIGHT / 2,
    17,
    "#666666",
    "normal",
    "left",
  );

  drawText(
    ctx,
    `${rows.length} TEAM${
      rows.length === 1
        ? ""
        : "S"
    }`,
    WIDTH - RIGHT,
    footerY +
      FOOTER_HEIGHT / 2,
    17,
    "#666666",
    "normal",
    "right",
  );

  return canvas.toBuffer(
    "image/png",
  );
}

async function getTablePost(
  divisionId: string,
  gameweek: number,
): Promise<TrackedPost | null> {
  const { data, error } =
    await supabase
      .from("gameweek_table_posts")
      .select("*")
      .eq(
        "division_id",
        divisionId,
      )
      .eq(
        "gameweek",
        gameweek,
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "[TABLES] Failed to load tracked table post:",
      error,
    );

    return null;
  }

  return data as TrackedPost | null;
}

async function deleteTrackedPost(
  client: Client,
  tracked: TrackedPost,
) {
  try {
    const channel =
      await client.channels.fetch(
        tracked.channel_id,
      );

    if (
      channel &&
      "messages" in channel &&
      channel.type ===
        ChannelType.GuildText
    ) {
      const message =
        await channel.messages.fetch(
          tracked.message_id,
        );

      await message
        .delete()
        .catch(
          () => undefined,
        );
    }
  } catch {
    // Message may already be gone.
  }

  await supabase
    .from("gameweek_table_posts")
    .delete()
    .eq("id", tracked.id);
}

async function isTrackedPostHealthy(
  client: Client,
  tracked: TrackedPost,
): Promise<boolean> {
  try {
    const channel =
      await client.channels.fetch(
        tracked.channel_id,
      );

    if (
      !channel ||
      !("messages" in channel)
    ) {
      return false;
    }

    const message =
      await channel.messages.fetch(
        tracked.message_id,
      );

    return Boolean(message);
  } catch {
    return false;
  }
}

async function postTable(
  client: Client,
  division: Division,
  gameweekNumber: number,
) {
  const guildSettings =
    await getGuildSettings(
      division.league_id,
    );

  const guildId =
    guildSettings?.guild_id;

  if (!guildId) {
    console.warn(
      `[TABLES] No guild configured for league ${division.league_id}`,
    );

    return;
  }

  const channelSettings =
    await getChannelSettings(
      guildId,
      division.id,
    );

  const channelId =
    channelSettings?.table_channel_id;

  if (!channelId) {
    console.warn(
      `[TABLES] No table channel configured for division ${division.id}`,
    );

    return;
  }

  const channel =
    await client.channels.fetch(
      channelId,
    );

  if (
    !channel ||
    channel.type !==
      ChannelType.GuildText
  ) {
    console.warn(
      `[TABLES] Table channel ${channelId} is not a text channel.`,
    );

    return;
  }

  const teams = await getTeams(
    division.id,
  );

  if (!teams.length) {
    console.warn(
      `[TABLES] No teams found for division ${division.id}`,
    );

    return;
  }

  const standings =
    await getStandings(
      division.id,
    );

  const rows = buildTable(
    teams,
    standings,
  );

  if (!rows.length) {
    console.warn(
      `[TABLES] No table rows generated for division ${division.id}`,
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
        /^-+|-+$/g,
        "",
      ) || "division";

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
      files: [attachment],
    });

  const { data, error } =
    await supabase
      .from("gameweek_table_posts")
      .insert({
        division_id: division.id,
        gameweek: gameweekNumber,
        channel_id: channelId,
        message_id: message.id,
      })
      .select()
      .single();

  if (error) {
    console.error(
      "[TABLES] Failed to track table post:",
      error,
    );

    await message
      .delete()
      .catch(
        () => undefined,
      );

    return;
  }

  console.log(
    `[TABLES] Posted ${division.name} GW${gameweekNumber} table (${message.id})`,
  );

  return data;
}

async function gameweekIsComplete(
  divisionId: string,
  gameweekNumber: number,
): Promise<boolean> {
  const { data, error } =
    await supabase
      .from("fixtures")
      .select("id,status")
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
      `[TABLES] Failed to check GW${gameweekNumber}:`,
      error,
    );

    return false;
  }

  if (!data?.length) {
    return false;
  }

  return data.every(
    (
      fixture: {
        status: string | null;
      },
    ) =>
      String(
        fixture.status,
      ).toLowerCase() ===
      "completed",
  );
}

async function checkDivision(
  client: Client,
  division: Division,
) {
  const initialPost =
    await getTablePost(
      division.id,
      0,
    );

  if (initialPost) {
    const healthy =
      await isTrackedPostHealthy(
        client,
        initialPost,
      );

    if (!healthy) {
      await deleteTrackedPost(
        client,
        initialPost,
      );
    }
  }

  const refreshedInitialPost =
    await getTablePost(
      division.id,
      0,
    );

  if (!refreshedInitialPost) {
    await postTable(
      client,
      division,
      0,
    );
  }

  const {
    data: gameweeks,
    error,
  } = await supabase
    .from("gameweeks")
    .select(
      "id,division_id,number,starts_at,created_at",
    )
    .eq(
      "division_id",
      division.id,
    )
    .order("number", {
      ascending: true,
    });

  if (error) {
    console.error(
      `[TABLES] Failed to load gameweeks for ${division.name}:`,
      error,
    );

    return;
  }

  if (!gameweeks?.length) {
    return;
  }

  for (const gameweek of gameweeks) {
    const number =
      Number(gameweek.number);

    if (!Number.isFinite(number)) {
      continue;
    }

    const tracked =
      await getTablePost(
        division.id,
        number,
      );

    if (tracked) {
      const healthy =
        await isTrackedPostHealthy(
          client,
          tracked,
        );

      if (healthy) {
        continue;
      }

      await deleteTrackedPost(
        client,
        tracked,
      );
    }

    const complete =
      await gameweekIsComplete(
        division.id,
        number,
      );

    if (!complete) {
      break;
    }

    await postTable(
      client,
      division,
      number,
    );
  }
}

export async function checkGameweekTables(
  client: Client,
) {
  const {
    data: divisions,
    error,
  } = await supabase
    .from("divisions")
    .select(
      [
        "id",
        "league_id",
        "name",
        "tier",
        "season",
        "status",
        "gameweek_interval_days",
      ].join(","),
    )
    .in("status", [
      "active",
      "running",
    ]);

  if (error) {
    console.error(
      "[TABLES] Failed to load active divisions:",
      error,
    );

    return;
  }

  for (const division of
    (divisions ?? []) as Division[]) {
    try {
      await checkDivision(
        client,
        division,
      );
    } catch (error) {
      console.error(
        `[TABLES] Failed checking ${division.name}:`,
        error,
      );
    }
  }
}

export function startGameweekTableWatcher(
  client: Client,
) {
  let running = false;

  const run = async () => {
    if (running) {
      return;
    }

    running = true;

    try {
      await checkGameweekTables(
        client,
      );
    } catch (error) {
      console.error(
        "[TABLES] Watcher error:",
        error,
      );
    } finally {
      running = false;
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
