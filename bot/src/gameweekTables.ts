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

const BODY_START_Y =
  TOP_HEIGHT + HEADER_HEIGHT;

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

for (const fontPath of FONT_CANDIDATES) {
  if (!existsSync(fontPath)) {
    continue;
  }

  try {
    registerFont(fontPath, {
      family: "DejaVu Sans",
    });

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

if (
  !FONT_CANDIDATES.some((fontPath) =>
    existsSync(fontPath),
  )
) {
  console.log(
    "[TABLES] DejaVuSans.ttf not found. Using system font fallback.",
  );
}

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

type Fixture = {
  id: string;
  division_id: string;
  gameweek: number | null;
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
};

/* =========================
   HELPERS
========================= */

function getInitials(
  name: string,
): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
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

async function loadTeamLogo(
  url: string | null | undefined,
) {
  if (!url) {
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

    return await loadImage(buffer);
  } catch {
    return null;
  }
}

function drawFallbackBadge(
  ctx: any,
  initials: string,
  x: number,
  y: number,
  size: number,
) {
  const centerX =
    x + size / 2;

  const centerY =
    y + size / 2;

  ctx.beginPath();

  ctx.arc(
    centerX,
    centerY,
    size / 2,
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
    `700 ${Math.round(size * 0.3)}px "${FONT_FAMILY}"`;

  drawTextCenter(
    ctx,
    initials,
    centerX,
    centerY + size * 0.1,
  );
}

/* =========================
   SUPABASE
========================= */

async function getGuildSettings(
  leagueId: string,
): Promise<LeagueSettings | null> {
  console.log(
    `[TABLES] Loading league channel settings for league ${leagueId}...`,
  );

  const { data, error } =
    await supabase
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

  console.log(
    `[TABLES] League channel settings result: ${JSON.stringify(data)}`,
  );

  return data as LeagueSettings | null;
}

async function getStandings(
  divisionId: string,
): Promise<Standing[]> {
  console.log(
    `[TABLES] Loading standings for division ${divisionId}...`,
  );

  const { data, error } =
    await supabase
      .from("standings")
      .select(
        `
          team_id,
          played,
          wins,
          draws,
          losses,
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

  console.log(
    `[TABLES] Loaded ${data?.length ?? 0} standings rows for division ${divisionId}`,
  );

  return (data ??
    []) as unknown as Standing[];
}

async function getTablePost(
  divisionId: string,
  gameweek: number,
): Promise<TablePost | null> {
  console.log(
    `[TABLES] Checking tracked table post for division ${divisionId}, GW${gameweek}...`,
  );

  const { data, error } =
    await supabase
      .from(
        "gameweek_table_posts",
      )
      .select(
        "division_id, gameweek_number, channel_id, message_id",
      )
      .eq(
        "division_id",
        divisionId,
      )
      .eq(
        "gameweek_number",
        gameweek,
      )
      .maybeSingle();

  if (error) {
    console.error(
      "[TABLES] Failed to load tracked table post:",
      error,
    );

    return null;
  }

  if (!data) {
    console.log(
      `[TABLES] No tracked table post found for division ${divisionId}, GW${gameweek}`,
    );

    return null;
  }

  console.log(
    `[TABLES] Found tracked table post: ${data.message_id}`,
  );

  return {
    divisionId:
      data.division_id,
    gameweek:
      data.gameweek_number,
    channelId:
      data.channel_id,
    messageId:
      data.message_id,
  };
}

async function saveTablePost(
  divisionId: string,
  gameweekNumber: number,
  channelId: string,
  messageId: string,
) {
  console.log(
    `[TABLES] Saving tracked table post for division ${divisionId}, GW${gameweekNumber}...`,
  );

  const { error } =
    await supabase
      .from(
        "gameweek_table_posts",
      )
      .upsert(
        {
          division_id:
            divisionId,
          gameweek_number:
            gameweekNumber,
          channel_id:
            channelId,
          message_id:
            messageId,
        },
        {
          onConflict:
            "division_id,gameweek_number",
        },
      );

  if (error) {
    console.error(
      "[TABLES] Failed to save tracked table post:",
      error,
    );

    return;
  }

  console.log(
    `[TABLES] Successfully saved tracked table post ${messageId}`,
  );
}

/* =========================
   IMAGE GENERATION
========================= */

async function generateTableImage(
  division: Division,
  standings: Standing[],
  gameweek: number,
): Promise<Buffer> {
  console.log(
    `[TABLES] Generating image for ${division.name}, GW${gameweek}, ${standings.length} teams...`,
  );

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
    canvas.getContext("2d");

  ctx.fillStyle = "#080808";

  ctx.fillRect(
    0,
    0,
    WIDTH,
    height,
  );

  /* =========================
     TOP
  ========================= */

  ctx.fillStyle = "#ffffff";
  ctx.font =
    `700 48px "${FONT_FAMILY}"`;

  ctx.textAlign = "left";

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

  ctx.fillStyle = "#aaaaaa";

  ctx.font =
    `700 22px "${FONT_FAMILY}"`;

  drawTextRight(
    ctx,
    "LEAGUE TABLE",
    WIDTH - RIGHT,
    70,
  );

  ctx.fillStyle = "#666666";

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

  ctx.fillStyle = "#171717";
  ctx.fill();

  const columns = [
    {
      name: "#",
      x:
        LEFT +
        POSITION_WIDTH / 2,
      width: POSITION_WIDTH,
    },
    {
      name: "TEAM",
      x:
        LEFT +
        POSITION_WIDTH +
        20,
      width: TEAM_WIDTH,
    },
    {
      name: "P",
      x:
        LEFT +
        POSITION_WIDTH +
        TEAM_WIDTH +
        STAT_WIDTH / 2,
      width: STAT_WIDTH,
    },
    {
      name: "W",
      x:
        LEFT +
        POSITION_WIDTH +
        TEAM_WIDTH +
        STAT_WIDTH * 1.5,
      width: STAT_WIDTH,
    },
    {
      name: "D",
      x:
        LEFT +
        POSITION_WIDTH +
        TEAM_WIDTH +
        STAT_WIDTH * 2.5,
      width: STAT_WIDTH,
    },
    {
      name: "L",
      x:
        LEFT +
        POSITION_WIDTH +
        TEAM_WIDTH +
        STAT_WIDTH * 3.5,
      width: STAT_WIDTH,
    },
    {
      name: "GF",
      x:
        LEFT +
        POSITION_WIDTH +
        TEAM_WIDTH +
        STAT_WIDTH * 4.5,
      width: STAT_WIDTH,
    },
    {
      name: "GA",
      x:
        LEFT +
        POSITION_WIDTH +
        TEAM_WIDTH +
        STAT_WIDTH * 5.5,
      width: STAT_WIDTH,
    },
    {
      name: "GD",
      x:
        LEFT +
        POSITION_WIDTH +
        TEAM_WIDTH +
        STAT_WIDTH * 6 +
        GOAL_DIFF_WIDTH / 2,
      width: GOAL_DIFF_WIDTH,
    },
    {
      name: "PTS",
      x:
        WIDTH -
        RIGHT -
        POINTS_WIDTH / 2,
      width: POINTS_WIDTH,
    },
  ];

  ctx.fillStyle = "#aaaaaa";

  ctx.font =
    `700 18px "${FONT_FAMILY}"`;

  for (const column of columns) {
    drawTextCenter(
      ctx,
      column.name,
      column.x,
      TOP_HEIGHT + 50,
    );
  }

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
      index * ROW_HEIGHT;

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

    /* Position */

    ctx.fillStyle = "#dddddd";

    ctx.font =
      `24px "${FONT_FAMILY}"`;

    drawTextCenter(
      ctx,
      String(index + 1),
      LEFT +
        POSITION_WIDTH / 2,
      rowY +
        ROW_HEIGHT / 2 +
        8,
    );

    /* Team */

    const team =
      standing.teams;

    const teamName =
      team?.name ??
      "Unknown Team";

    const logoSize = 58;

    const logoX =
      LEFT +
      POSITION_WIDTH +
      18;

    const logoY =
      rowY +
      (ROW_HEIGHT -
        logoSize) /
        2;

    const logo =
      await loadTeamLogo(
        team?.logo_url,
      );

    if (logo) {
      try {
        const ratio =
          Math.min(
            logoSize /
              logo.width,
            logoSize /
              logo.height,
          );

        const drawWidth =
          logo.width *
          ratio;

        const drawHeight =
          logo.height *
          ratio;

        const drawX =
          logoX +
          (logoSize -
            drawWidth) /
            2;

        const drawY =
          logoY +
          (logoSize -
            drawHeight) /
            2;

        ctx.drawImage(
          logo,
          drawX,
          drawY,
          drawWidth,
          drawHeight,
        );
      } catch {
        drawFallbackBadge(
          ctx,
          getInitials(
            teamName,
          ),
          logoX,
          logoY,
          logoSize,
        );
      }
    } else {
      drawFallbackBadge(
        ctx,
        getInitials(
          teamName,
        ),
        logoX,
        logoY,
        logoSize,
      );
    }

    ctx.fillStyle = "#ffffff";

    ctx.font =
      `700 25px "${FONT_FAMILY}"`;

    ctx.textAlign = "left";

    ctx.fillText(
      teamName,
      logoX +
        logoSize +
        20,
      rowY +
        ROW_HEIGHT / 2 +
        8,
    );

    /* Stats */

    ctx.fillStyle = "#dddddd";

    ctx.font =
      `24px "${FONT_FAMILY}"`;

    const statY =
      rowY +
      ROW_HEIGHT / 2 +
      8;

    const statValues = [
      standing.played,
      standing.wins,
      standing.draws,
      standing.losses,
      standing.goals_for,
      standing.goals_against,
    ];

    for (
      let statIndex = 0;
      statIndex <
        statValues.length;
      statIndex++
    ) {
      const x =
        LEFT +
        POSITION_WIDTH +
        TEAM_WIDTH +
        STAT_WIDTH *
          statIndex +
        STAT_WIDTH / 2;

      drawTextCenter(
        ctx,
        String(
          statValues[
            statIndex
          ] ?? 0,
        ),
        x,
        statY,
      );
    }

    let gd =
      standing.goal_difference ??
      0;

    const gdText =
      gd > 0
        ? `+${gd}`
        : String(gd);

    drawTextCenter(
      ctx,
      gdText,
      LEFT +
        POSITION_WIDTH +
        TEAM_WIDTH +
        STAT_WIDTH * 6 +
        GOAL_DIFF_WIDTH / 2,
      statY,
    );

    ctx.fillStyle = "#ffffff";

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

  ctx.fillStyle = "#666666";

  ctx.font =
    `17px "${FONT_FAMILY}"`;

  ctx.textAlign = "left";

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

  console.log(
    `[TABLES] Image generated successfully for ${division.name}, GW${gameweek}`,
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
) {
  console.log(
    `[TABLES] ===== POST TABLE START: ${division.name} GW${gameweekNumber} =====`,
  );

  const leagueSettings =
    await getGuildSettings(
      division.league_id,
    );

  if (
    !leagueSettings?.table_channel_id
  ) {
    console.error(
      `[TABLES] No table channel configured for league ${division.league_id}`,
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
      `[TABLES] Table channel ${leagueSettings.table_channel_id} is unavailable or not text based.`,
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
        name: `nova-table-${division.id}-gw${gameweekNumber}.png`,
      },
    );

  const message =
    await (
      channel as TextChannel
    ).send({
      files: [attachment],
    });

  console.log(
    `[TABLES] Discord table posted successfully. Message ${message.id}`,
  );

  await saveTablePost(
    division.id,
    gameweekNumber,
    leagueSettings.table_channel_id,
    message.id,
  );

  console.log(
    `[TABLES] ===== POST TABLE END: ${division.name} GW${gameweekNumber} =====`,
  );
}

/* =========================
   GAMEWEEK CHECKING
========================= */

async function checkDivision(
  client: Client,
  division: Division,
) {
  console.log(
    `[TABLES] >>> Checking division ${division.name} (${division.id}) status=${division.status}`,
  );

  const standings =
    await getStandings(
      division.id,
    );

  console.log(
    `[TABLES] ${division.name}: ${standings.length} standings rows loaded.`,
  );

  /*
   * GW0 is the initial league table.
   */

  const existingGW0 =
    await getTablePost(
      division.id,
      0,
    );

  if (!existingGW0) {
    console.log(
      `[TABLES] ${division.name}: GW0 does not exist. Posting initial table...`,
    );

    await postTable(
      client,
      division,
      standings,
      0,
    );
  } else {
    console.log(
      `[TABLES] ${division.name}: GW0 already exists as ${existingGW0.messageId}`,
    );
  }

  /* =========================
     LOAD GAMEWEEKS
  ========================= */

  console.log(
    `[TABLES] ${division.name}: Loading gameweeks...`,
  );

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
    `[TABLES] ${division.name}: Found ${gameweeks?.length ?? 0} gameweeks.`,
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

    const tracked =
      await getTablePost(
        division.id,
        number,
      );

    if (tracked) {
      console.log(
        `[TABLES] ${division.name}: GW${number} already posted, skipping.`,
      );

      continue;
    }

    console.log(
      `[TABLES] ${division.name}: Checking fixtures for GW${number}...`,
    );

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

    console.log(
      `[TABLES] ${division.name}: GW${number} has ${fixtures?.length ?? 0} fixtures.`,
    );

    if (
      !fixtures ||
      fixtures.length === 0
    ) {
      console.log(
        `[TABLES] ${division.name}: GW${number} has no fixtures yet. Stopping here.`,
      );

      break;
    }

    const incomplete =
      fixtures.some(
        (fixture: {
          status: string | null;
        }) =>
          fixture.status !==
          "completed",
      );

    if (incomplete) {
      console.log(
        `[TABLES] ${division.name}: GW${number} is not complete yet. Stopping here.`,
      );

      break;
    }

    console.log(
      `[TABLES] ${division.name}: GW${number} is COMPLETE. Posting table...`,
    );

    const updatedStandings =
      await getStandings(
        division.id,
      );

    await postTable(
      client,
      division,
      updatedStandings,
      number,
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
    "[TABLES] ========================================",
  );

  console.log(
    "[TABLES] checkGameweekTables() STARTED",
  );

  console.log(
    "[TABLES] Loading active/running divisions...",
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

  console.log(
    `[TABLES] Active/running divisions found: ${divisions?.length ?? 0}`,
  );

  if (
    !divisions ||
    divisions.length === 0
  ) {
    console.log(
      "[TABLES] NO ACTIVE/RUNNING DIVISIONS FOUND. Nothing to generate.",
    );

    /*
     * Diagnostic only:
     * Load all statuses so we can see what the database
     * actually contains.
     */

    const {
      data: allDivisions,
      error: allDivisionsError,
    } = await supabase
      .from("divisions")
      .select(
        "id, name, status",
      );

    if (allDivisionsError) {
      console.error(
        "[TABLES] Failed to load all division statuses:",
        allDivisionsError,
      );
    } else {
      console.log(
        "[TABLES] ALL DIVISION STATUSES:",
        allDivisions,
      );
    }

    return;
  }

  for (const division of
    (divisions ??
      []) as unknown as Division[]) {
    console.log(
      `[TABLES] Starting division: ${division.name} | status=${division.status} | id=${division.id}`,
    );

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

  console.log(
    "[TABLES] checkGameweekTables() FINISHED",
  );

  console.log(
    "[TABLES] ========================================",
  );
}

/* =========================
   WATCHER
========================= */

export function startGameweekTableWatcher(
  client: Client,
) {
  console.log(
    "[TABLES] ========================================",
  );

  console.log(
    "[TABLES] GAMEWEEK TABLE WATCHER STARTING",
  );

  console.log(
    "[TABLES] Running initial table check NOW...",
  );

  void checkGameweekTables(
    client,
  ).catch((error) => {
    console.error(
      "[TABLES] Initial table check crashed:",
      error,
    );
  });

  setInterval(() => {
    console.log(
      "[TABLES] 30-second table watcher tick...",
    );

    void checkGameweekTables(
      client,
    ).catch((error) => {
      console.error(
        "[TABLES] Scheduled table check crashed:",
        error,
      );
    });
  }, 30_000);
}
