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
import { supabase } from "./database.js";
import path from "node:path";

/* =========================================================
   FONTS
========================================================= */

const FONTS_DIR = path.join(process.cwd(), "fonts");

registerFont(
  path.join(FONTS_DIR, "Inter-Regular.ttf"),
  {
    family: "Inter",
    weight: "400",
  },
);

registerFont(
  path.join(FONTS_DIR, "Inter-Bold.ttf"),
  {
    family: "Inter",
    weight: "700",
  },
);

/* =========================================================
   TABLE DESIGN
========================================================= */

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

/* =========================================================
   TYPES
========================================================= */

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
  team_name: string;
  logo_url: string | null;
};

type Division = {
  id: string;
  league_id: string;
  name: string;
  tier: number | null;
  season: string | null;
  status: string | null;
  start_date: string | null;
};

type TablePost = {
  division_id: string;
  gameweek_number: number;
  channel_id: string;
  message_id: string;
  cycle_started_at: string | null;
};

/* =========================================================
   WATCHER LOCK
========================================================= */

let checkRunning = false;

/* =========================================================
   HELPERS
========================================================= */

function getInitials(name: string): string {
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

  ctx.moveTo(x + radius, y);

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

function centerText(
  ctx: any,
  text: string,
  x: number,
  y: number,
) {
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

function rightText(
  ctx: any,
  text: string,
  x: number,
  y: number,
) {
  ctx.textAlign = "right";
  ctx.fillText(text, x, y);
}

/* =========================================================
   LOGOS
========================================================= */

async function loadTeamLogo(
  url: string | null,
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
      console.log(
        `[TABLES] Logo request failed: ${response.status}`,
      );

      return null;
    }

    const buffer =
      Buffer.from(
        await response.arrayBuffer(),
      );

    if (buffer.length === 0) {
      return null;
    }

    return await loadImage(buffer);
  } catch (error) {
    console.log(
      "[TABLES] Could not load team logo:",
      error,
    );

    return null;
  }
}

function drawFallbackLogo(
  ctx: any,
  name: string,
  centerX: number,
  centerY: number,
  size: number,
) {
  ctx.save();

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
    `700 ${Math.round(size * 0.3)}px "Inter"`;

  centerText(
    ctx,
    getInitials(name),
    centerX,
    centerY + size * 0.1,
  );

  ctx.restore();
}

async function drawTeamLogo(
  ctx: any,
  logoUrl: string | null,
  teamName: string,
  centerX: number,
  centerY: number,
  size: number,
) {
  const image =
    await loadTeamLogo(logoUrl);

  if (!image) {
    drawFallbackLogo(
      ctx,
      teamName,
      centerX,
      centerY,
      size,
    );

    return;
  }

  try {
    ctx.save();

    ctx.beginPath();

    ctx.arc(
      centerX,
      centerY,
      size / 2,
      0,
      Math.PI * 2,
    );

    ctx.fillStyle = "#181818";
    ctx.fill();

    ctx.restore();

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

    const scale = Math.min(
      size / image.width,
      size / image.height,
    );

    const width =
      image.width * scale;

    const height =
      image.height * scale;

    const x =
      centerX - width / 2;

    const y =
      centerY - height / 2;

    ctx.drawImage(
      image,
      x,
      y,
      width,
      height,
    );

    ctx.restore();

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      centerX,
      centerY,
      size / 2,
      0,
      Math.PI * 2,
    );

    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  } catch (error) {
    console.error(
      `[TABLES] Failed drawing logo for ${teamName}:`,
      error,
    );

    drawFallbackLogo(
      ctx,
      teamName,
      centerX,
      centerY,
      size,
    );
  }
}

/* =========================================================
   STANDINGS
========================================================= */

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
      "[TABLES] STANDINGS QUERY FAILED:",
      error,
    );

    return [];
  }

  return ((data ?? []) as any[]).map(
    (row) => ({
      team_id: row.team_id,

      played: Number(
        row.played ?? 0,
      ),

      wins: Number(
        row.won ?? 0,
      ),

      draws: Number(
        row.drawn ?? 0,
      ),

      losses: Number(
        row.lost ?? 0,
      ),

      goals_for: Number(
        row.goals_for ?? 0,
      ),

      goals_against: Number(
        row.goals_against ?? 0,
      ),

      goal_difference: Number(
        row.goal_difference ?? 0,
      ),

      points: Number(
        row.points ?? 0,
      ),

      team_name:
        row.teams?.name ??
        "Unknown Team",

      logo_url:
        row.teams?.logo_url ??
        null,
    }),
  );
}

/* =========================================================
   TABLE POST RECORD
========================================================= */

async function getTablePost(
  divisionId: string,
  gameweek: number,
): Promise<TablePost | null> {
  const {
    data,
    error,
  } = await supabase
    .from("gameweek_table_posts")
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
    .order("created_at", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    console.error(
      "[TABLES] Failed to load table post:",
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

  const row = data[0];

  return {
    division_id:
      row.division_id,

    gameweek_number:
      row.gameweek_number,

    channel_id:
      row.channel_id,

    message_id:
      row.message_id,

    cycle_started_at:
      row.cycle_started_at ??
      null,
  };
}

/* =========================================================
   DELETE STALE POST RECORD
========================================================= */

async function deleteTablePostRecord(
  divisionId: string,
  gameweek: number,
  messageId: string,
) {
  const {
    error,
  } = await supabase
    .from("gameweek_table_posts")
    .delete()
    .eq(
      "division_id",
      divisionId,
    )
    .eq(
      "gameweek_number",
      gameweek,
    )
    .eq(
      "message_id",
      messageId,
    );

  if (error) {
    console.error(
      "[TABLES] Failed removing stale table record:",
      error,
    );

    return false;
  }

  console.log(
    `[TABLES] Removed stale table record ${messageId}`,
  );

  return true;
}

/* =========================================================
   CHANNEL
========================================================= */

async function getTableChannelId(
  leagueId: string,
): Promise<string | null> {
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
      "[TABLES] Failed loading channel settings:",
      error,
    );

    return null;
  }

  return (
    data?.table_channel_id ??
    null
  );
}

/* =========================================================
   IMAGE
========================================================= */

async function generateTableImage(
  division: Division,
  standings: Standing[],
  gameweek: number,
): Promise<Buffer> {
  const height =
    TOP_HEIGHT +
    HEADER_HEIGHT +
    Math.max(
      standings.length,
      1,
    ) *
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

  /* BRANDING */

  ctx.fillStyle = "#ffffff";

  ctx.font =
    '700 48px "Inter"';

  ctx.textAlign = "left";

  ctx.fillText(
    "NOVA",
    LEFT,
    70,
  );

  ctx.font =
    '700 30px "Inter"';

  ctx.fillText(
    division.name,
    LEFT,
    125,
  );

  ctx.fillStyle = "#aaaaaa";

  ctx.font =
    '700 22px "Inter"';

  rightText(
    ctx,
    `GW${gameweek} • LEAGUE TABLE`,
    WIDTH - RIGHT,
    70,
  );

  ctx.fillStyle = "#666666";

  ctx.font =
    '400 18px "Inter"';

  rightText(
    ctx,
    "VRFS • NOVA",
    WIDTH - RIGHT,
    110,
  );

  /* HEADER */

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

  const headerY =
    TOP_HEIGHT + 50;

  ctx.fillStyle = "#aaaaaa";

  ctx.font =
    '700 18px "Inter"';

  centerText(
    ctx,
    "#",
    LEFT +
      POSITION_WIDTH / 2,
    headerY,
  );

  ctx.textAlign = "left";

  ctx.fillText(
    "TEAM",
    LEFT +
      POSITION_WIDTH +
      20,
    headerY,
  );

  const statsX =
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
    centerText(
      ctx,
      headers[i],
      statsX +
        i *
          STAT_WIDTH +
        STAT_WIDTH / 2,
      headerY,
    );
  }

  centerText(
    ctx,
    "GD",
    statsX +
      6 *
        STAT_WIDTH +
      GOAL_DIFF_WIDTH / 2,
    headerY,
  );

  centerText(
    ctx,
    "PTS",
    WIDTH -
      RIGHT -
      POINTS_WIDTH / 2,
    headerY,
  );

  /* EMPTY */

  if (
    standings.length === 0
  ) {
    ctx.fillStyle = "#0c0c0c";

    ctx.fillRect(
      LEFT,
      BODY_START_Y,
      TABLE_WIDTH,
      ROW_HEIGHT,
    );

    ctx.fillStyle = "#666666";

    ctx.font =
      '700 22px "Inter"';

    centerText(
      ctx,
      "NO TEAMS REGISTERED",
      WIDTH / 2,
      BODY_START_Y +
        ROW_HEIGHT / 2 +
        8,
    );
  }

  /* ROWS */

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

    /* POSITION */

    ctx.fillStyle =
      "#dddddd";

    ctx.font =
      '400 24px "Inter"';

    centerText(
      ctx,
      String(index + 1),
      LEFT +
        POSITION_WIDTH / 2,
      rowY +
        ROW_HEIGHT / 2 +
        8,
    );

    /* LOGO */

    const logoSize = 58;

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
      standing.logo_url,
      standing.team_name,
      logoCenterX,
      logoCenterY,
      logoSize,
    );

    /* TEAM */

    ctx.fillStyle =
      "#ffffff";

    ctx.font =
      '700 25px "Inter"';

    ctx.textAlign = "left";

    ctx.fillText(
      standing.team_name,
      LEFT +
        POSITION_WIDTH +
        18 +
        logoSize +
        20,
      rowY +
        ROW_HEIGHT / 2 +
        8,
    );

    /* STATS */

    ctx.fillStyle =
      "#dddddd";

    ctx.font =
      '400 24px "Inter"';

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
      centerText(
        ctx,
        String(values[i]),
        statsX +
          i *
            STAT_WIDTH +
          STAT_WIDTH / 2,
        statY,
      );
    }

    const gd =
      standing.goal_difference;

    centerText(
      ctx,
      gd > 0
        ? `+${gd}`
        : String(gd),
      statsX +
        6 *
          STAT_WIDTH +
        GOAL_DIFF_WIDTH / 2,
      statY,
    );

    /* POINTS */

    ctx.fillStyle =
      "#ffffff";

    ctx.font =
      '700 27px "Inter"';

    centerText(
      ctx,
      String(standing.points),
      WIDTH -
        RIGHT -
        POINTS_WIDTH / 2,
      statY,
    );
  }

  /* FOOTER */

  const footerY =
    BODY_START_Y +
    Math.max(
      standings.length,
      1,
    ) *
      ROW_HEIGHT;

  ctx.fillStyle =
    "#666666";

  ctx.font =
    '400 17px "Inter"';

  ctx.textAlign = "left";

  ctx.fillText(
    "Generated automatically by NOVA",
    LEFT,
    footerY + 44,
  );

  rightText(
    ctx,
    `${standings.length} TEAM(S)`,
    WIDTH - RIGHT,
    footerY + 44,
  );

  return canvas.toBuffer(
    "image/png",
  );
}

/* =========================================================
   FETCH EXISTING DISCORD MESSAGE
========================================================= */

async function getExistingDiscordMessage(
  client: Client,
  existing: TablePost,
) {
  try {
    const channel =
      await client.channels.fetch(
        existing.channel_id,
      );

    if (
      !channel ||
      !channel.isTextBased()
    ) {
      return null;
    }

    const textChannel =
      channel as TextChannel;

    return await textChannel.messages.fetch(
      existing.message_id,
    );
  } catch {
    return null;
  }
}

/* =========================================================
   UPDATE EXISTING MESSAGE
========================================================= */

async function updateExistingTable(
  client: Client,
  existing: TablePost,
  image: Buffer,
  division: Division,
  gameweek: number,
): Promise<boolean> {
  try {
    const message =
      await getExistingDiscordMessage(
        client,
        existing,
      );

    if (!message) {
      console.log(
        `[TABLES] Tracked message ${existing.message_id} is gone.`,
      );

      await deleteTablePostRecord(
        division.id,
        gameweek,
        existing.message_id,
      );

      return false;
    }

    const attachment =
      new AttachmentBuilder(
        image,
        {
          name:
            `nova-table-${division.id}-gw${gameweek}.png`,
        },
      );

    await message.edit({
      content: "",
      files: [attachment],
    });

    console.log(
      `[TABLES] UPDATED ${division.name} GW${gameweek}: ${existing.message_id}`,
    );

    return true;
  } catch (error) {
    console.error(
      "[TABLES] Failed updating existing table:",
      error,
    );

    return false;
  }
}

/* =========================================================
   CREATE NEW TABLE
========================================================= */

async function createNewTable(
  client: Client,
  division: Division,
  gameweek: number,
  image: Buffer,
): Promise<{
  channelId: string;
  messageId: string;
} | null> {
  const channelId =
    await getTableChannelId(
      division.league_id,
    );

  if (!channelId) {
    console.error(
      `[TABLES] No table channel configured for ${division.name}`,
    );

    return null;
  }

  const channel =
    await client.channels.fetch(
      channelId,
    );

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    console.error(
      `[TABLES] Table channel is not text based: ${channelId}`,
    );

    return null;
  }

  const attachment =
    new AttachmentBuilder(
      image,
      {
        name:
          `nova-table-${division.id}-gw${gameweek}.png`,
      },
    );

  const message =
    await (
      channel as TextChannel
    ).send({
      files: [attachment],
    });

  console.log(
    `[TABLES] CREATED ${division.name} GW${gameweek}: ${message.id}`,
  );

  return {
    channelId,
    messageId: message.id,
  };
}

/* =========================================================
   SAVE / UPDATE RECORD
========================================================= */

async function saveTablePost(
  division: Division,
  gameweek: number,
  channelId: string,
  messageId: string,
) {
  const existing =
    await getTablePost(
      division.id,
      gameweek,
    );

  if (existing) {
    const { error } =
      await supabase
        .from("gameweek_table_posts")
        .update({
          channel_id:
            channelId,
          message_id:
            messageId,
          cycle_started_at:
            division.start_date ??
            new Date().toISOString(),
        })
        .eq(
          "division_id",
          division.id,
        )
        .eq(
          "gameweek_number",
          gameweek,
        );

    if (error) {
      console.error(
        "[TABLES] Failed updating table post record:",
        error,
      );

      return false;
    }

    return true;
  }

  const { error } =
    await supabase
      .from(
        "gameweek_table_posts",
      )
      .insert({
        division_id:
          division.id,

        gameweek_number:
          gameweek,

        channel_id:
          channelId,

        message_id:
          messageId,

        cycle_started_at:
          division.start_date ??
          new Date().toISOString(),
      });

  if (error) {
    console.error(
      "[TABLES] Failed saving table post:",
      error,
    );

    return false;
  }

  return true;
}

/* =========================================================
   POST OR UPDATE
========================================================= */

async function postOrUpdateTable(
  client: Client,
  division: Division,
  standings: Standing[],
  gameweek: number,
) {
  if (
    standings.length === 0
  ) {
    return;
  }

  const image =
    await generateTableImage(
      division,
      standings,
      gameweek,
    );

  /*
   * FIRST:
   * Look for the one database record for
   * this division + gameweek.
   */
  const existing =
    await getTablePost(
      division.id,
      gameweek,
    );

  /*
   * IF RECORD EXISTS:
   *
   * Try editing the exact Discord message.
   *
   * If it exists, we're DONE.
   * No new message gets created.
   */
  if (existing) {
    const updated =
      await updateExistingTable(
        client,
        existing,
        image,
        division,
        gameweek,
      );

    if (updated) {
      return;
    }

    /*
     * updateExistingTable removes the stale
     * database record if the Discord message
     * genuinely no longer exists.
     */
  }

  /*
   * Only now are we allowed to create a new
   * Discord table.
   */
  const created =
    await createNewTable(
      client,
      division,
      gameweek,
      image,
    );

  if (!created) {
    return;
  }

  /*
   * Save the new message as the ONLY tracked
   * message for this division + gameweek.
   */
  const saved =
    await saveTablePost(
      division,
      gameweek,
      created.channelId,
      created.messageId,
    );

  /*
   * If another record somehow won the race,
   * remove the newly-created Discord message
   * rather than leaving duplicate tables.
   */
  if (!saved) {
    try {
      const channel =
        await client.channels.fetch(
          created.channelId,
        );

      if (
        channel &&
        channel.isTextBased()
      ) {
        const message =
          await (
            channel as TextChannel
          ).messages.fetch(
            created.messageId,
          );

        await message.delete();

        console.log(
          `[TABLES] Deleted duplicate table message ${created.messageId}`,
        );
      }
    } catch (error) {
      console.error(
        "[TABLES] Could not clean up duplicate table:",
        error,
      );
    }
  }
}

/* =========================================================
   CHECK DIVISION
========================================================= */

async function checkDivision(
  client: Client,
  division: Division,
) {
  const standings =
    await getStandings(
      division.id,
    );

  /*
   * Keep the existing initial table
   * behaviour for GW0.
   */
  if (
    standings.length > 0
  ) {
    await postOrUpdateTable(
      client,
      division,
      standings,
      0,
    );
  }

  const {
    data: gameweeks,
    error,
  } = await supabase
    .from("gameweeks")
    .select(
      "id, division_id, number, starts_at, created_at",
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
      `[TABLES] Failed loading gameweeks for ${division.name}:`,
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

  for (
    const gameweek of gameweeks
  ) {
    const number =
      Number(
        gameweek.number,
      );

    if (
      !Number.isFinite(number) ||
      number <= 0
    ) {
      continue;
    }

    const {
      data: fixtures,
      error: fixtureError,
    } = await supabase
      .from("fixtures")
      .select(
        "id, status",
      )
      .eq(
        "division_id",
        division.id,
      )
      .eq(
        "gameweek",
        number,
      );

    if (fixtureError) {
      console.error(
        `[TABLES] Failed loading fixtures for ${division.name} GW${number}:`,
        fixtureError,
      );

      break;
    }

    if (
      !fixtures ||
      fixtures.length === 0
    ) {
      break;
    }

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
      break;
    }

    const currentStandings =
      await getStandings(
        division.id,
      );

    if (
      currentStandings.length === 0
    ) {
      break;
    }

    await postOrUpdateTable(
      client,
      division,
      currentStandings,
      number,
    );
  }
}

/* =========================================================
   MAIN CHECK
========================================================= */

async function checkGameweekTables(
  client: Client,
) {
  if (checkRunning) {
    return;
  }

  checkRunning = true;

  try {
    const {
      data: divisions,
      error,
    } = await supabase
      .from("divisions")
      .select(
        "id, league_id, name, tier, season, status, start_date",
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
        "[TABLES] Failed loading divisions:",
        error,
      );

      return;
    }

    for (
      const division of
        (divisions ??
          []) as unknown as Division[]
    ) {
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
  } finally {
    checkRunning = false;
  }
}

/* =========================================================
   WATCHER
========================================================= */

export function startGameweekTableWatcher(
  client: Client,
) {
  console.log(
    "[TABLES] Gameweek table watcher started.",
  );

  void checkGameweekTables(
    client,
  );

  setInterval(
    () => {
      void checkGameweekTables(
        client,
      );
    },
    30_000,
  );
}
