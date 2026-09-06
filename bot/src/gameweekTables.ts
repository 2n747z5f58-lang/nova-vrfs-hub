import {
  AttachmentBuilder,
  ChannelType,
  Client,
  TextChannel,
} from "discord.js";
import sharp from "sharp";
import { supabase } from "./database.js";
type Division = {
  id: string;
  league_id: string;
  name: string;
  status: string | null;
};
type League = {
  id: string;
  name: string;
};
type Team = {
  id: string;
  name: string;
  logo_url: string | null;
};
type Standing = {
  team_id: string;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goal_difference: number | null;
  points: number | null;
};
type Fixture = {
  id: string;
  gameweek: number | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
};
type TableRow = {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};
const WATCH_INTERVAL_MS = 30_000;
let watcherStarted = false;
let watcherRunning = false;
/* =========================
   HELPERS
========================= */
function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
function truncate(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}
function formatNumber(
  value: number | null | undefined,
) {
  return value ?? 0;
}
function sortRows(rows: TableRow[]) {
  return [...rows].sort((a, b) => {
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
}
/* =========================
   TEAM LOGOS
========================= */
async function fetchLogoDataUri(
  url: string | null,
): Promise<string | null> {
  if (!url) {
    return null;
  }
  try {
    const controller =
      new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 8_000);
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return null;
    }
    const contentType =
      response.headers.get(
        "content-type",
      ) ?? "image/png";
    if (!contentType.startsWith("image/")) {
      return null;
    }
    const buffer = Buffer.from(
      await response.arrayBuffer(),
    );
    if (buffer.length === 0) {
      return null;
    }
    return `data:${contentType};base64,${buffer.toString(
      "base64",
    )}`;
  } catch {
    return null;
  }
}
/* =========================
   DATA
========================= */
async function getLeague(
  leagueId: string,
): Promise<League | null> {
  const { data, error } =
    await supabase
      .from("leagues")
      .select("id,name")
      .eq("id", leagueId)
      .maybeSingle();
  if (error) {
    console.error(
      "Failed to load league:",
      error,
    );
    return null;
  }
  return data as League | null;
}
async function getTeams(
  divisionId: string,
): Promise<Team[]> {
  const { data, error } =
    await supabase
      .from("teams")
      .select(
        "id,name,logo_url",
      )
      .eq(
        "division_id",
        divisionId,
      )
      .order("name");
  if (error) {
    console.error(
      "Failed to load division teams:",
      error,
    );
    return [];
  }
  return (data ?? []) as Team[];
}
async function getStandings(
  divisionId: string,
): Promise<Standing[]> {
  const { data, error } =
    await supabase
      .from("standings")
      .select(
        "team_id,played,won,drawn,lost,goals_for,goals_against,goal_difference,points",
      )
      .eq(
        "division_id",
        divisionId,
      );
  if (error) {
    console.error(
      "Failed to load standings:",
      error,
    );
    return [];
  }
  return (data ?? []) as Standing[];
}
async function getFixtures(
  divisionId: string,
  gameweekNumber: number,
): Promise<Fixture[]> {
  const { data, error } =
    await supabase
      .from("fixtures")
      .select(
        "id,gameweek,home_team_id,away_team_id,home_score,away_score,status",
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
      `Failed to load GW${gameweekNumber} fixtures:`,
      error,
    );
    return [];
  }
  return (data ?? []) as Fixture[];
}
async function getTableChannelId(
  leagueId: string,
): Promise<string | null> {
  const { data, error } =
    await supabase
      .from("league_channel_settings")
      .select(
        "table_channel_id",
      )
      .eq(
        "league_id",
        leagueId,
      )
      .maybeSingle();
  if (error) {
    console.error(
      "Failed to load table channel:",
      error,
    );
    return null;
  }
  return (
    data?.table_channel_id ??
    null
  );
}
async function getGuildId(
  leagueId: string,
): Promise<string | null> {
  const { data, error } =
    await supabase
      .from("guild_settings")
      .select("guild_id")
      .eq(
        "league_id",
        leagueId,
      )
      .maybeSingle();
  if (error) {
    console.error(
      "Failed to load Discord guild:",
      error,
    );
    return null;
  }
  return data?.guild_id ?? null;
}
async function hasTablePost(
  divisionId: string,
  gameweekNumber: number,
) {
  const { data, error } =
    await supabase
      .from("gameweek_table_posts")
      .select("id")
      .eq(
        "division_id",
        divisionId,
      )
      .eq(
        "gameweek_number",
        gameweekNumber,
      )
      .maybeSingle();
  if (error) {
    console.error(
      "Failed to check existing table post:",
      error,
    );
    return false;
  }
  return Boolean(data);
}
/* =========================
   BUILD TABLE
========================= */
function buildRows(
  teams: Team[],
  standings: Standing[],
): TableRow[] {
  const standingMap =
    new Map(
      standings.map(
        (standing) => [
          standing.team_id,
          standing,
        ],
      ),
    );
  const rows = teams.map(
    (team) => {
      const standing =
        standingMap.get(
          team.id,
        );
      return {
        position: 0,
        team,
        played: formatNumber(
          standing?.played,
        ),
        won: formatNumber(
          standing?.won,
        ),
        drawn: formatNumber(
          standing?.drawn,
        ),
        lost: formatNumber(
          standing?.lost,
        ),
        goalsFor:
          formatNumber(
            standing?.goals_for,
          ),
        goalsAgainst:
          formatNumber(
            standing?.goals_against,
          ),
        goalDifference:
          formatNumber(
            standing?.goal_difference,
          ),
        points: formatNumber(
          standing?.points,
        ),
      };
    },
  );
  const sorted =
    sortRows(rows);
  return sorted.map(
    (row, index) => ({
      ...row,
      position:
        index + 1,
    }),
  );
}
/* =========================
   GENERATE SVG
========================= */
async function buildTableSvg(
  league: League,
  division: Division,
  gameweekNumber: number,
  rows: TableRow[],
) {
  const logoEntries =
    await Promise.all(
      rows.map(
        async (row) => [
          row.team.id,
          await fetchLogoDataUri(
            row.team.logo_url,
          ),
        ] as const,
      ),
    );
  const logoMap =
    new Map(logoEntries);
  const rowHeight = 76;
  const headerHeight = 170;
  const columnHeaderHeight = 70;
  const footerHeight = 70;
  const width = 1700;
  const height =
    headerHeight +
    columnHeaderHeight +
    rows.length *
      rowHeight +
    footerHeight;
  const left = 80;
  const positionX = 80;
  const teamX = 170;
  const pX = 850;
  const wX = 950;
  const dX = 1040;
  const lX = 1130;
  const gfX = 1230;
  const gaX = 1330;
  const gdX = 1430;
  const ptsX = 1550;
  const title =
    gameweekNumber === 0
      ? "GW0 TABLE"
      : `GW${gameweekNumber} TABLE`;
  const svgRows =
    rows
      .map(
        (
          row,
          index,
        ) => {
          const y =
            headerHeight +
            columnHeaderHeight +
            index *
              rowHeight;
          const logo =
            logoMap.get(
              row.team.id,
            );
          const logoMarkup =
            logo
              ? `
                <image
                  href="${logo}"
                  x="${teamX}"
                  y="${y + 14}"
                  width="48"
                  height="48"
                  preserveAspectRatio="xMidYMid meet"
                />
              `
              : `
                <circle
                  cx="${teamX + 24}"
                  cy="${y + 38}"
                  r="24"
                  fill="#27272a"
                />
                <text
                  x="${teamX + 24}"
                  y="${y + 45}"
                  text-anchor="middle"
                  font-family="DejaVu Sans"
                  font-size="16"
                  font-weight="700"
                  fill="#ffffff"
                >${escapeXml(
                  row.team.name
                    .slice(
                      0,
                      2,
                    )
                    .toUpperCase(),
                )}</text>
              `;
          const teamName =
            escapeXml(
              truncate(
                row.team.name,
                27,
              ),
            );
          const gd =
            row.goalDifference >
            0
              ? `+${row.goalDifference}`
              : `${row.goalDifference}`;
          return `
            <rect
              x="40"
              y="${y}"
              width="${width - 80}"
              height="${rowHeight}"
              rx="12"
              fill="${
                index % 2 === 0
                  ? "#111111"
                  : "#161616"
              }"
            />
            <text
              x="${positionX}"
              y="${y + 47}"
              font-family="DejaVu Sans"
              font-size="22"
              font-weight="700"
              fill="#a1a1aa"
            >${row.position}</text>
            ${logoMarkup}
            <text
              x="${teamX + 70}"
              y="${y + 46}"
              font-family="DejaVu Sans"
              font-size="21"
              font-weight="700"
              fill="#ffffff"
            >${teamName}</text>
            <text
              x="${pX}"
              y="${y + 46}"
              text-anchor="middle"
              font-family="DejaVu Sans"
              font-size="20"
              font-weight="400"
              fill="#d4d4d8"
            >${row.played}</text>
            <text
              x="${wX}"
              y="${y + 46}"
              text-anchor="middle"
              font-family="DejaVu Sans"
              font-size="20"
              font-weight="400"
              fill="#d4d4d8"
            >${row.won}</text>
            <text
              x="${dX}"
              y="${y + 46}"
              text-anchor="middle"
              font-family="DejaVu Sans"
              font-size="20"
              font-weight="400"
              fill="#d4d4d8"
            >${row.drawn}</text>
            <text
              x="${lX}"
              y="${y + 46}"
              text-anchor="middle"
              font-family="DejaVu Sans"
              font-size="20"
              font-weight="400"
              fill="#d4d4d8"
            >${row.lost}</text>
            <text
              x="${gfX}"
              y="${y + 46}"
              text-anchor="middle"
              font-family="DejaVu Sans"
              font-size="20"
              font-weight="400"
              fill="#d4d4d8"
            >${row.goalsFor}</text>
            <text
              x="${gaX}"
              y="${y + 46}"
              text-anchor="middle"
              font-family="DejaVu Sans"
              font-size="20"
              font-weight="400"
              fill="#d4d4d8"
            >${row.goalsAgainst}</text>
            <text
              x="${gdX}"
              y="${y + 46}"
              text-anchor="middle"
              font-family="DejaVu Sans"
              font-size="20"
              font-weight="700"
              fill="#ffffff"
            >${gd}</text>
            <text
              x="${ptsX}"
              y="${y + 46}"
              text-anchor="middle"
              font-family="DejaVu Sans"
              font-size="23"
              font-weight="700"
              fill="#ffffff"
            >${row.points}</text>
          `;
        },
      )
      .join("\n");
  return `
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
      <!-- HEADER -->
      <rect
        x="40"
        y="30"
        width="${width - 80}"
        height="${headerHeight - 20}"
        rx="24"
        fill="#0d0d0d"
        stroke="#27272a"
        stroke-width="2"
      />
      <text
        x="${left}"
        y="83"
        font-family="DejaVu Sans"
        font-size="34"
        font-weight="700"
        fill="#ffffff"
      >NOVA</text>
      <text
        x="${left}"
        y="126"
        font-family="DejaVu Sans"
        font-size="25"
        font-weight="700"
        fill="#d4d4d8"
      >${escapeXml(
        league.name,
      )}</text>
      <text
        x="${width - 80}"
        y="83"
        text-anchor="end"
        font-family="DejaVu Sans"
        font-size="29"
        font-weight="700"
        fill="#ffffff"
      >${escapeXml(
        title,
      )}</text>
      <text
        x="${width - 80}"
        y="126"
        text-anchor="end"
        font-family="DejaVu Sans"
        font-size="19"
        font-weight="700"
        fill="#71717a"
      >${escapeXml(
        division.name,
      )}</text>
      <!-- COLUMN HEADER -->
      <rect
        x="40"
        y="${headerHeight}"
        width="${width - 80}"
        height="${columnHeaderHeight}"
        rx="12"
        fill="#18181b"
      />
      <text
        x="${positionX}"
        y="${headerHeight + 45}"
        font-family="DejaVu Sans"
        font-size="17"
        font-weight="700"
        fill="#71717a"
      >#</text>
      <text
        x="${teamX + 70}"
        y="${headerHeight + 45}"
        font-family="DejaVu Sans"
        font-size="17"
        font-weight="700"
        fill="#71717a"
      >TEAM</text>
      <text
        x="${pX}"
        y="${headerHeight + 45}"
        text-anchor="middle"
        font-family="DejaVu Sans"
        font-size="17"
        font-weight="700"
        fill="#71717a"
      >P</text>
      <text
        x="${wX}"
        y="${headerHeight + 45}"
        text-anchor="middle"
        font-family="DejaVu Sans"
        font-size="17"
        font-weight="700"
        fill="#71717a"
      >W</text>
      <text
        x="${dX}"
        y="${headerHeight + 45}"
        text-anchor="middle"
        font-family="DejaVu Sans"
        font-size="17"
        font-weight="700"
        fill="#71717a"
      >D</text>
      <text
        x="${lX}"
        y="${headerHeight + 45}"
        text-anchor="middle"
        font-family="DejaVu Sans"
        font-size="17"
        font-weight="700"
        fill="#71717a"
      >L</text>
      <text
        x="${gfX}"
        y="${headerHeight + 45}"
        text-anchor="middle"
        font-family="DejaVu Sans"
        font-size="17"
        font-weight="700"
        fill="#71717a"
      >GF</text>
      <text
        x="${gaX}"
        y="${headerHeight + 45}"
        text-anchor="middle"
        font-family="DejaVu Sans"
        font-size="17"
        font-weight="700"
        fill="#71717a"
      >GA</text>
      <text
        x="${gdX}"
        y="${headerHeight + 45}"
        text-anchor="middle"
        font-family="DejaVu Sans"
        font-size="17"
        font-weight="700"
        fill="#71717a"
      >GD</text>
      <text
        x="${ptsX}"
        y="${headerHeight + 45}"
        text-anchor="middle"
        font-family="DejaVu Sans"
        font-size="17"
        font-weight="700"
        fill="#ffffff"
      >PTS</text>
      <!-- TABLE ROWS -->
      ${svgRows}
      <!-- FOOTER -->
      <text
        x="${left}"
        y="${height - 25}"
        font-family="DejaVu Sans"
        font-size="14"
        font-weight="700"
        fill="#52525b"
      >NOVA - VRFS FOOTBALL</text>
      <text
        x="${width - 80}"
        y="${height - 25}"
        text-anchor="end"
        font-family="DejaVu Sans"
        font-size="14"
        font-weight="700"
        fill="#52525b"
      >${new Date().toLocaleDateString(
        "en-GB",
      )}</text>
    </svg>
  `;
}
/* =========================
   GENERATE PNG
========================= */
async function generateTablePng(
  league: League,
  division: Division,
  gameweekNumber: number,
  rows: TableRow[],
) {
  const svg =
    await buildTableSvg(
      league,
      division,
      gameweekNumber,
      rows,
    );
  return sharp(
    Buffer.from(svg),
  )
    .png()
    .toBuffer();
}
/* =========================
   POST TABLE
========================= */
async function postTable(
  client: Client,
  division: Division,
  gameweekNumber: number,
) {
  const existing =
    await hasTablePost(
      division.id,
      gameweekNumber,
    );
  if (existing) {
    return;
  }
  const league =
    await getLeague(
      division.league_id,
    );
  if (!league) {
    return;
  }
  const tableChannelId =
    await getTableChannelId(
      division.league_id,
    );
  if (!tableChannelId) {
    console.log(
      `No table channel configured for ${league.name}.`,
    );
    return;
  }
  const guildId =
    await getGuildId(
      division.league_id,
    );
  if (!guildId) {
    console.log(
      `No Discord server configured for ${league.name}.`,
    );
    return;
  }
  const guild =
    client.guilds.cache.get(
      guildId,
    );
  if (!guild) {
    console.log(
      `NOVA is not currently in Discord guild ${guildId}.`,
    );
    return;
  }
  const channel =
    await guild.channels.fetch(
      tableChannelId,
    );
  if (
    !channel ||
    channel.type !==
      ChannelType.GuildText
  ) {
    console.log(
      `Configured table channel ${tableChannelId} is not a normal text channel.`,
    );
    return;
  }
  const teams =
    await getTeams(
      division.id,
    );
  if (teams.length === 0) {
    console.log(
      `Skipping ${division.name} GW${gameweekNumber}: no teams.`,
    );
    return;
  }
  const standings =
    await getStandings(
      division.id,
    );
  const rows =
    buildRows(
      teams,
      standings,
    );
  const png =
    await generateTablePng(
      league,
      division,
      gameweekNumber,
      rows,
    );
  const filename =
    `nova-${league.name}-${division.name}-gw${gameweekNumber}-table.png`
      .toLowerCase()
      .replace(
        /[^a-z0-9.-]+/g,
        "-",
      );
  const attachment =
    new AttachmentBuilder(
      png,
      {
        name: filename,
      },
    );
  const text =
    gameweekNumber === 0
      ? `GW0 TABLE - ${division.name}\nThe opening standings for ${league.name}.`
      : `GW${gameweekNumber} TABLE - ${division.name}\nThe standings have been updated after Gameweek ${gameweekNumber}.`;
  let message;
  try {
    message =
      await (
        channel as TextChannel
      ).send({
        content: text,
        files: [attachment],
      });
  } catch (error) {
    console.error(
      `Failed to post ${division.name} GW${gameweekNumber} table:`,
      error,
    );
    return;
  }
  const {
    error: insertError,
  } = await supabase
    .from(
      "gameweek_table_posts",
    )
    .insert({
      division_id:
        division.id,
      gameweek_number:
        gameweekNumber,
      channel_id:
        tableChannelId,
      message_id:
        message.id,
    });
  if (insertError) {
    console.error(
      `Failed to record ${division.name} GW${gameweekNumber} table post:`,
      insertError,
    );
    return;
  }
  console.log(
    `Posted ${league.name} • ${division.name} • GW${gameweekNumber} table.`,
  );
}
/* =========================
   CHECK GAMEWEEKS
========================= */
async function checkDivision(
  client: Client,
  division: Division,
) {
  if (
    division.status !==
    "active"
  ) {
    return;
  }
  /*
   * GW0 is posted once the
   * division is active.
   */
  await postTable(
    client,
    division,
    0,
  );
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
    .order("number");
  if (error) {
    console.error(
      `Failed to load gameweeks for ${division.name}:`,
      error,
    );
    return;
  }
  for (
    const gameweek of
      gameweeks ?? []
  ) {
    const number =
      Number(
        gameweek.number,
      );
    if (
      !Number.isInteger(
        number,
      ) ||
      number < 1
    ) {
      continue;
    }
    if (
      await hasTablePost(
        division.id,
        number,
      )
    ) {
      continue;
    }
    const fixtures =
      await getFixtures(
        division.id,
        number,
      );
    if (
      fixtures.length ===
      0
    ) {
      continue;
    }
    const complete =
      fixtures.every(
        (fixture) =>
          fixture.home_score !==
            null &&
          fixture.away_score !==
            null,
      );
    if (!complete) {
      continue;
    }
    await postTable(
      client,
      division,
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
  if (
    watcherRunning
  ) {
    return;
  }
  watcherRunning = true;
  try {
    const {
      data: divisions,
      error,
    } = await supabase
      .from("divisions")
      .select(
        "id,league_id,name,status",
      )
      .eq(
        "status",
        "active",
      )
      .order("tier");
    if (error) {
      console.error(
        "Failed to load active divisions:",
        error,
      );
      return;
    }
    for (
      const division of
        (divisions ??
          []) as Division[]
    ) {
      try {
        await checkDivision(
          client,
          division,
        );
      } catch (error) {
        console.error(
          `Gameweek table watcher failed for ${division.name}:`,
          error,
        );
      }
    }
  } finally {
    watcherRunning =
      false;
  }
}
/* =========================
   START WATCHER
========================= */
export function startGameweekTableWatcher(
  client: Client,
) {
  if (
    watcherStarted
  ) {
    return;
  }
  watcherStarted = true;
  console.log(
    "NOVA automatic Gameweek table watcher started.",
  );
  void checkGameweekTables(
    client,
  );
  setInterval(() => {
    void checkGameweekTables(
      client,
    );
  }, WATCH_INTERVAL_MS);
}
