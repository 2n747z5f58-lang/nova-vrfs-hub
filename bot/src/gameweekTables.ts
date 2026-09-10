import {
  AttachmentBuilder,
  Client,
  TextChannel,
} from "discord.js";
import {
  createCanvas,
  loadImage,
  registerFont,
} from "canvas";
import { existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { supabase } from "./database.js";

/* =========================
   DESIGN
========================= */

const WIDTH = 1600;

const TOP_HEIGHT = 190;
const HEADER_HEIGHT = 80;
const ROW_HEIGHT = 100;
const FOOTER_HEIGHT = 70;

const LEFT = 50;
const RIGHT = 50;

const TABLE_WIDTH =
  WIDTH - LEFT - RIGHT;

const POSITION_WIDTH = 80;
const TEAM_WIDTH = 655;
const STAT_WIDTH = 90;
const GOAL_DIFF_WIDTH = 105;
const POINTS_WIDTH = 120;

const BODY_START_Y =
  TOP_HEIGHT + HEADER_HEIGHT;

/* =========================
   FONT
========================= */

const FONT_CANDIDATES = [
  fileURLToPath(
    new URL(
      "../assets/fonts/DejaVuSans.ttf",
      import.meta.url,
    ),
  ),
  fileURLToPath(
    new URL(
      "../fonts/DejaVuSans.ttf",
      import.meta.url,
    ),
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

let FONT_FAMILY = "DejaVu Sans";

let registeredFont = false;

for (const fontPath of FONT_CANDIDATES) {
  if (!existsSync(fontPath)) {
    continue;
  }

  try {
    registerFont(fontPath, {
      family: "DejaVu Sans",
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
  console.log(
    "[TABLES] Using system font fallback.",
  );
}

/* =========================
   TYPES
========================= */

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
  teams?: {
    name?: string | null;
    logo_url?: string | null;
  } | null;
};

type Division = {
  id: string;
  league_id: string;
  name: string;
  tier: number | null;
  season: string | null;
  status: string | null;
};

type LeagueSettings = {
  league_id: string;
  table_channel_id: string | null;
};

type TablePost = {
  divisionId: string;
  gameweek: number;
  channelId: string;
  messageId: string;
  cycleStartedAt: string | null;
};

/* =========================
   TEXT HELPERS
========================= */

function getInitials(
  name: string,
): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

function roundedRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();

  ctx.moveTo(
    x + radius,
    y,
  );

  ctx.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    radius,
  );

  ctx.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    radius,
  );

  ctx.arcTo(
    x,
    y + height,
    x,
    y,
    radius,
  );

  ctx.arcTo(
    x,
    y,
    x + width,
    y,
    radius,
  );

  ctx.closePath();
}

function drawTextCenter(
  ctx: any,
  text: string,
  x: number,
  y: number,
) {
  ctx.textAlign = "center";
  ctx.fillText(
    text,
    x,
    y,
  );
}

function drawTextRight(
  ctx: any,
  text: string,
  x: number,
  y: number,
) {
  ctx.textAlign = "right";
  ctx.fillText(
    text,
    x,
    y,
  );
}

/* =========================
   LOGOS
========================= */

async function loadTeamLogo(
  url: string | null | undefined,
) {
  if (!url) {
    return null;
  }

  try {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        8000,
      );

    const response =
      await fetch(
        url,
        {
          signal:
            controller.signal,
        },
      );

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const buffer =
      Buffer.from(
        await response.arrayBuffer(),
      );

    return await loadImage(
      buffer,
    );
  } catch {
    return null;
  }
}

function drawFallbackBadge(
  ctx: any,
  initials: string,
  centerX: number,
  centerY: number,
  size: number,
) {
  const radius =
    size / 2;

  ctx.save();

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

  ctx.strokeStyle = "#555555";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";

  ctx.font =
    `700 ${Math.round(
      size * 0.3,
    )}px "${FONT_FAMILY}"`;

  drawTextCenter(
    ctx,
    initials,
    centerX,
    centerY +
      size * 0.1,
  );

  ctx.restore();
}

async function drawTeamLogo(
  ctx: any,
  logoUrl: string | null | undefined,
  teamName: string,
  centerX: number,
  centerY: number,
  size: number,
) {
  const image =
    await loadTeamLogo(
      logoUrl,
    );

  if (!image) {
    drawFallbackBadge(
      ctx,
      getInitials(
        teamName,
      ),
      centerX,
      centerY,
      size,
    );

    return;
  }

  try {
    /*
     * The logo is clipped to a circle.
     * This prevents square/rectangular image
     * backgrounds from appearing in the table.
     */

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      centerX,
      centerY,
      size / 2,
      0,
      Math.PI * 2,
    );

    ctx.clip();

    /*
     * Contain the image while keeping its
     * original aspect ratio.
     */

    const scale =
      Math.min(
        size / image.width,
        size / image.height,
      );

    const drawWidth =
      image.width * scale;

    const drawHeight =
      image.height * scale;

    const drawX =
      centerX -
      drawWidth / 2;

    const drawY =
      centerY -
      drawHeight / 2;

    ctx.drawImage(
      image,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );

    ctx.restore();

    /*
     * Subtle circular outline.
     */

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      centerX,
      centerY,
      size / 2,
      0,
      Math.PI * 2,
    );

    ctx.strokeStyle =
      "#333333";

    ctx.lineWidth = 2;

    ctx.stroke();

    ctx.restore();
  } catch {
    drawFallbackBadge(
      ctx,
      getInitials(
        teamName,
      ),
      centerX,
      centerY,
      size,
    );
  }
}

/* =========================
   DATABASE
========================= */

async function getLeagueSettings(
  leagueId: string,
): Promise<LeagueSettings | null> {
  const {
    data,
    error,
  } = await supabase
    .from(
      "league_channel_settings",
    )
    .select(
      "league_id, table_channel_id",
    )
    .eq(
      "league_id",
      leagueId,
    )
    .maybeSingle();

  if (error) {
    console.error(
      "[TABLES] Failed to load league channel settings:",
      error,
    );

    return null;
  }

  return data as LeagueSettings | null;
}

/* =========================
   STANDINGS
========================= */

async function getStandings(
  divisionId: string,
): Promise<Standing[]> {
  const {
    data,
    error,
  } = await supabase
    .from("standings")
    .select(
      `
        team_id,
        played,
        won,
        drawn,
        lost,
        goals_for,
        goals_against,
        goal_difference,
        points,
        teams (
          name,
          logo_url
        )
      `,
    )
    .eq(
      "division_id",
      divisionId,
    )
    .order(
      "points",
      {
        ascending: false,
      },
    )
    .order(
      "goal_difference",
      {
        ascending: false,
      },
    )
    .order(
      "goals_for",
      {
        ascending: false,
      },
    );

  if (error) {
    console.error(
      "[TABLES] Failed to load standings:",
      error,
    );

    return [];
  }

  return (
    data ?? []
  ).map(
    (
      row: any,
    ) => ({
      team_id:
        row.team_id,
      played:
        Number(
          row.played ?? 0,
        ),
      wins:
        Number(
          row.won ?? 0,
        ),
      draws:
        Number(
          row.drawn ?? 0,
        ),
      losses:
        Number(
          row.lost ?? 0,
        ),
      goals_for:
        Number(
          row.goals_for ?? 0,
        ),
      goals_against:
        Number(
          row.goals_against ?? 0,
        ),
      goal_difference:
        Number(
          row.goal_difference ??
            0,
        ),
      points:
        Number(
          row.points ?? 0,
        ),
      teams:
        row.teams ?? null,
    }),
  );
}

/* =========================
   TRACKED POSTS
========================= */

async function getTablePost(
  divisionId: string,
  gameweek: number,
): Promise<TablePost | null> {
  /*
   * Do NOT use maybeSingle().
   *
   * The database already contains historical
   * duplicate GW0 records. We only need the
   * newest valid one.
   */

  const {
    data,
    error,
  } = await supabase
    .from(
      "gameweek_table_posts",
    )
    .select(
      `
        division_id,
        gameweek_number,
        channel_id,
        message_id,
        cycle_started_at,
        created_at
      `,
    )
    .eq(
      "division_id",
      divisionId,
    )
    .eq(
      "gameweek_number",
      gameweek,
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    )
    .limit(1);

  if (error) {
    console.error(
      "[TABLES] Failed to load tracked table post:",
      error,
    );

    return null;
  }

  if (
    !data ||
    data.length === 0
  ) {
    return null;
  }

  const row =
    data[0];

  return {
    divisionId:
      row.division_id,
    gameweek:
      row.gameweek_number,
    channelId:
      row.channel_id,
    messageId:
      row.message_id,
    cycleStartedAt:
      row.cycle_started_at ??
      null,
  };
}

/* =========================
   SAVE TABLE POST
========================= */

async function saveTablePost(
  divisionId: string,
  gameweekNumber: number,
  channelId: string,
  messageId: string,
  cycleStartedAt: string | null,
) {
  /*
   * The real unique index is:
   *
   * division_id,
   * cycle_started_at,
   * gameweek_number
   *
   * However, because old rows may have
   * different/null cycle values, we deliberately
   * avoid an invalid onConflict here.
   *
   * getTablePost() already prevents duplicates.
   */

  const {
    error,
  } = await supabase
    .from(
      "gameweek_table_posts",
    )
    .insert({
      division_id:
        divisionId,
      gameweek_number:
        gameweekNumber,
      channel_id:
        channelId,
      message_id:
        messageId,
      cycle_started_at:
        cycleStartedAt,
    });

  if (error) {
    /*
     * If another watcher tick managed to insert
     * the record at the same time, don't crash
     * the entire watcher.
     */

    console.error(
      "[TABLES] Failed to save tracked table post:",
      error,
    );

    return;
  }

  console.log(
    `[TABLES] Saved table post ${messageId}`,
  );
}

/* =========================
   IMAGE
========================= */

async function generateTableImage(
  division: Division,
  standings: Standing[],
  gameweek: number,
): Promise<Buffer> {
  const height =
    TOP_HEIGHT +
    HEADER_HEIGHT +
    standings.length *
      ROW_HEIGHT +
    FOOTER_HEIGHT;

  const canvas =
    createCanvas(
      WIDTH,
      height,
    );

  const ctx =
    canvas.getContext(
      "2d",
    );

  /* =========================
     BACKGROUND
  ========================= */

  ctx.fillStyle =
    "#080808";

  ctx.fillRect(
    0,
    0,
    WIDTH,
    height,
  );

  /* =========================
     TOP
  ========================= */

  ctx.fillStyle =
    "#ffffff";

  ctx.font =
    `700 48px "${FONT_FAMILY}"`;

  ctx.textAlign =
    "left";

  ctx.fillText(
    "NOVA",
    LEFT,
    70,
  );

  ctx.font =
    `700 30px "${FONT_FAMILY}"`;

  ctx.fillText(
    division.name,
    LEFT,
    125,
  );

  ctx.fillStyle =
    "#aaaaaa";

  ctx.font =
    `700 22px "${FONT_FAMILY}"`;

  drawTextRight(
    ctx,
    "LEAGUE TABLE",
    WIDTH - RIGHT,
    70,
  );

  ctx.fillStyle =
    "#666666";

  ctx.font =
    `18px "${FONT_FAMILY}"`;

  drawTextRight(
    ctx,
    "VRFS • NOVA",
    WIDTH - RIGHT,
    110,
  );

  /* =========================
     HEADER
  ========================= */

  roundedRect(
    ctx,
    LEFT,
    TOP_HEIGHT,
    TABLE_WIDTH,
    HEADER_HEIGHT,
    12,
  );

  ctx.fillStyle =
    "#171717";

  ctx.fill();

  const headerY =
    TOP_HEIGHT + 50;

  ctx.fillStyle =
    "#aaaaaa";

  ctx.font =
    `700 18px "${FONT_FAMILY}"`;

  drawTextCenter(
    ctx,
    "#",
    LEFT +
      POSITION_WIDTH / 2,
    headerY,
  );

  ctx.textAlign =
    "left";

  ctx.fillText(
    "TEAM",
    LEFT +
      POSITION_WIDTH +
      20,
    headerY,
  );

  const statStart =
    LEFT +
    POSITION_WIDTH +
    TEAM_WIDTH;

  const headers = [
    "P",
    "W",
    "D",
    "L",
    "GF",
    "GA",
  ];

  for (
    let i = 0;
    i < headers.length;
    i++
  ) {
    drawTextCenter(
      ctx,
      headers[i],
      statStart +
        STAT_WIDTH * i +
        STAT_WIDTH / 2,
      headerY,
    );
  }

  drawTextCenter(
    ctx,
    "GD",
    statStart +
      STAT_WIDTH * 6 +
      GOAL_DIFF_WIDTH / 2,
    headerY,
  );

  drawTextCenter(
    ctx,
    "PTS",
    WIDTH -
      RIGHT -
      POINTS_WIDTH / 2,
    headerY,
  );

  /* =========================
     ROWS
  ========================= */

  for (
    let index = 0;
    index < standings.length;
    index++
  ) {
    const standing =
      standings[index];

    const rowY =
      BODY_START_Y +
      index *
        ROW_HEIGHT;

    ctx.fillStyle =
      index % 2 === 0
        ? "#0c0c0c"
        : "#111111";

    ctx.fillRect(
      LEFT,
      rowY,
      TABLE_WIDTH,
      ROW_HEIGHT,
    );

    ctx.strokeStyle =
      "#222222";

    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(
      LEFT,
      rowY +
        ROW_HEIGHT,
    );

    ctx.lineTo(
      LEFT +
        TABLE_WIDTH,
      rowY +
        ROW_HEIGHT,
    );

    ctx.stroke();

    /* =========================
       POSITION
    ========================= */

    ctx.fillStyle =
      "#dddddd";

    ctx.font =
      `24px "${FONT_FAMILY}"`;

    drawTextCenter(
      ctx,
      String(
        index + 1,
      ),
      LEFT +
        POSITION_WIDTH / 2,
      rowY +
        ROW_HEIGHT / 2 +
        8,
    );

    /* =========================
       TEAM LOGO
    ========================= */

    const teamName =
      standing.teams
        ?.name ??
      "Unknown Team";

    const logoSize =
      58;

    const logoCenterX =
      LEFT +
      POSITION_WIDTH +
      18 +
      logoSize / 2;

    const logoCenterY =
      rowY +
      ROW_HEIGHT / 2;

    await drawTeamLogo(
      ctx,
      standing.teams
        ?.logo_url,
      teamName,
      logoCenterX,
      logoCenterY,
      logoSize,
    );

    /* =========================
       TEAM NAME
    ========================= */

    ctx.fillStyle =
      "#ffffff";

    ctx.font =
      `700 25px "${FONT_FAMILY}"`;

    ctx.textAlign =
      "left";

    ctx.fillText(
      teamName,
      LEFT +
        POSITION_WIDTH +
        18 +
        logoSize +
        20,
      rowY +
        ROW_HEIGHT / 2 +
        8,
    );

    /* =========================
       STATS
    ========================= */

    ctx.fillStyle =
      "#dddddd";

    ctx.font =
      `24px "${FONT_FAMILY}"`;

    const statY =
      rowY +
      ROW_HEIGHT / 2 +
      8;

    const values = [
      standing.played,
      standing.wins,
      standing.draws,
      standing.losses,
      standing.goals_for,
      standing.goals_against,
    ];

    for (
      let i = 0;
      i < values.length;
      i++
    ) {
      drawTextCenter(
        ctx,
        String(
          values[i] ?? 0,
        ),
        statStart +
          STAT_WIDTH * i +
          STAT_WIDTH / 2,
        statY,
      );
    }

    const gd =
      standing.goal_difference ??
      0;

    const gdText =
      gd > 0
        ? `+${gd}`
        : String(gd);

    drawTextCenter(
      ctx,
      gdText,
      statStart +
        STAT_WIDTH * 6 +
        GOAL_DIFF_WIDTH / 2,
      statY,
    );

    /* =========================
       POINTS
    ========================= */

    ctx.fillStyle =
      "#ffffff";

    ctx.font =
      `700 27px "${FONT_FAMILY}"`;

    drawTextCenter(
      ctx,
      String(
        standing.points ?? 0,
      ),
      WIDTH -
        RIGHT -
        POINTS_WIDTH / 2,
      statY,
    );
  }

  /* =========================
     FOOTER
  ========================= */

  const footerY =
    BODY_START_Y +
    standings.length *
      ROW_HEIGHT;

  ctx.fillStyle =
    "#666666";

  ctx.font =
    `17px "${FONT_FAMILY}"`;

  ctx.textAlign =
    "left";

  ctx.fillText(
    "Generated automatically by NOVA",
    LEFT,
    footerY + 44,
  );

  drawTextRight(
    ctx,
    `${standings.length} TEAM(S)`,
    WIDTH - RIGHT,
    footerY + 44,
  );

  return canvas.toBuffer(
    "image/png",
  );
}

/* =========================
   POST TABLE
========================= */

async function postTable(
  client: Client,
  division: Division,
  standings: Standing[],
  gameweekNumber: number,
  cycleStartedAt: string | null,
) {
  /*
   * FINAL SAFETY CHECK
   *
   * Never post if we already have a tracked
   * table for this division/gameweek.
   */

  const alreadyPosted =
    await getTablePost(
      division.id,
      gameweekNumber,
    );

  if (alreadyPosted) {
    console.log(
      `[TABLES] ${division.name} GW${gameweekNumber} already posted. Skipping duplicate.`,
    );

    return;
  }

  const leagueSettings =
    await getLeagueSettings(
      division.league_id,
    );

  if (
    !leagueSettings ||
    !leagueSettings.table_channel_id
  ) {
    console.error(
      `[TABLES] No table channel configured for ${division.name}`,
    );

    return;
  }

  const channel =
    await client.channels.fetch(
      leagueSettings.table_channel_id,
    );

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    console.error(
      `[TABLES] Table channel ${leagueSettings.table_channel_id} is unavailable.`,
    );

    return;
  }

  /*
   * Don't generate/post a blank table.
   */

  if (standings.length === 0) {
    console.log(
      `[TABLES] ${division.name} has 0 standings rows. Not posting blank table.`,
    );

    return;
  }

  const image =
    await generateTableImage(
      division,
      standings,
      gameweekNumber,
    );

  const attachment =
    new AttachmentBuilder(
      image,
      {
        name:
          `nova-table-${division.id}-gw${gameweekNumber}.png`,
      },
    );

  const message =
    await (
      channel as TextChannel
    ).send({
      files: [
        attachment,
      ],
    });

  console.log(
    `[TABLES] Discord table posted successfully: ${message.id}`,
  );

  /*
   * Record it immediately.
   */

  await saveTablePost(
    division.id,
    gameweekNumber,
    leagueSettings.table_channel_id,
    message.id,
    cycleStartedAt,
  );
}

/* =========================
   DIVISION
========================= */

async function checkDivision(
  client: Client,
  division: Division,
) {
  console.log(
    `[TABLES] Checking ${division.name}`,
  );

  /*
   * ========================
   * GW0
   * ========================
   */

  let standings =
    await getStandings(
      division.id,
    );

  /*
   * GW0 is only posted when actual teams
   * exist in the standings.
   */

  const existingGW0 =
    await getTablePost(
      division.id,
      0,
    );

  if (!existingGW0) {
    if (
      standings.length > 0
    ) {
      await postTable(
        client,
        division,
        standings,
        0,
        null,
      );
    } else {
      console.log(
        `[TABLES] ${division.name}: no standings yet, so GW0 will wait.`,
      );
    }
  }

  /*
   * ========================
   * GAMEWEEKS
   * ========================
   */

  const {
    data: gameweeks,
    error: gameweeksError,
  } = await supabase
    .from("gameweeks")
    .select(
      "id, division_id, number, starts_at, created_at",
    )
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

  if (gameweeksError) {
    console.error(
      `[TABLES] Failed to load gameweeks for ${division.name}:`,
      gameweeksError,
    );

    return;
  }

  console.log(
    `[TABLES] ${division.name}: ${gameweeks?.length ?? 0} gameweeks found.`,
  );

  for (
    const gameweek of
      gameweeks ?? []
  ) {
    const number =
      gameweek.number;

    if (
      number === null ||
      number === undefined
    ) {
      continue;
    }

    /*
     * Already posted?
     */

    const existing =
      await getTablePost(
        division.id,
        number,
      );

    if (existing) {
      continue;
    }

    /*
     * Find fixtures.
     */

    const {
      data: fixtures,
      error: fixturesError,
    } = await supabase
      .from("fixtures")
      .select(
        "id, division_id, gameweek, status",
      )
      .eq(
        "division_id",
        division.id,
      )
      .eq(
        "gameweek",
        number,
      );

    if (fixturesError) {
      console.error(
        `[TABLES] Failed to load fixtures for ${division.name} GW${number}:`,
        fixturesError,
      );

      break;
    }

    if (
      !fixtures ||
      fixtures.length === 0
    ) {
      console.log(
        `[TABLES] ${division.name} GW${number}: no fixtures yet.`,
      );

      break;
    }

    /*
     * Every fixture must be completed.
     */

    const incomplete =
      fixtures.some(
        (
          fixture: {
            status:
              | string
              | null;
          },
        ) =>
          fixture.status !==
          "completed",
      );

    if (incomplete) {
      console.log(
        `[TABLES] ${division.name} GW${number}: not complete yet.`,
      );

      break;
    }

    /*
     * Completed gameweek.
     */

    standings =
      await getStandings(
        division.id,
      );

    if (
      standings.length === 0
    ) {
      console.log(
        `[TABLES] ${division.name} GW${number}: no standings rows, skipping.`,
      );

      break;
    }

    /*
     * Use the gameweek start as the cycle
     * identifier when available.
     */

    const cycleStartedAt =
      gameweek.starts_at ??
      null;

    await postTable(
      client,
      division,
      standings,
      number,
      cycleStartedAt,
    );
  }
}

/* =========================
   MAIN CHECK
========================= */

async function checkGameweekTables(
  client: Client,
) {
  console.log(
    "[TABLES] Checking gameweek tables...",
  );

  const {
    data: divisions,
    error,
  } = await supabase
    .from("divisions")
    .select(
      "id, league_id, name, tier, season, status",
    )
    .in(
      "status",
      [
        "active",
        "running",
      ],
    );

  if (error) {
    console.error(
      "[TABLES] Failed to load divisions:",
      error,
    );

    return;
  }

  if (
    !divisions ||
    divisions.length === 0
  ) {
    console.log(
      "[TABLES] No active/running divisions.",
    );

    return;
  }

  for (const division of
    divisions as unknown as Division[]) {
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

/* =========================
   WATCHER
========================= */

export function startGameweekTableWatcher(
  client: Client,
) {
  console.log(
    "[TABLES] Gameweek table watcher started.",
  );

  void checkGameweekTables(
    client,
  ).catch(
    (error) => {
      console.error(
        "[TABLES] Initial table check crashed:",
        error,
      );
    },
  );

  setInterval(
    () => {
      void checkGameweekTables(
        client,
      ).catch(
        (error) => {
          console.error(
            "[TABLES] Scheduled table check crashed:",
            error,
          );
        },
      );
    },
    30_000,
  );
}
