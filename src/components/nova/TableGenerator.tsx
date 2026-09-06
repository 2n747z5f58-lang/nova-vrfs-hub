import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
type Division = {
  id: string;
  league_id: string;
  name: string;
  tier: number | null;
  season: string | null;
};
type Team = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
};
type Standing = {
  id: string;
  division_id: string;
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
type TableRow = Standing & {
  team: Team | null;
};
type TableGeneratorProps = {
  leagueId: string;
  leagueName?: string | null;
};
const TABLE_WIDTH = 1400;
const HEADER_HEIGHT = 230;
const ROW_HEIGHT = 105;
const FOOTER_HEIGHT = 80;
function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image"));
    image.src = url;
  });
}
export function TableGenerator({
  leagueId,
  leagueName,
}: TableGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedDivision = useMemo(
    () =>
      divisions.find(
        (division) => division.id === selectedDivisionId,
      ) ?? null,
    [divisions, selectedDivisionId],
  );
  useEffect(() => {
    let cancelled = false;
    async function loadDivisions() {
      setLoadingDivisions(true);
      setError(null);
      const { data, error: divisionError } = await supabase
        .from("divisions")
        .select(
          "id,league_id,name,tier,season",
        )
        .eq("league_id", leagueId)
        .order("tier", {
          ascending: true,
        });
      if (cancelled) return;
      if (divisionError) {
        console.error(
          "Failed to load divisions:",
          divisionError,
        );
        setError("Failed to load divisions.");
        setLoadingDivisions(false);
        return;
      }
      const loadedDivisions = (data ?? []) as Division[];
      setDivisions(loadedDivisions);
      if (
        loadedDivisions.length > 0 &&
        !loadedDivisions.some(
          (division) =>
            division.id === selectedDivisionId,
        )
      ) {
        setSelectedDivisionId(
          loadedDivisions[0].id,
        );
      }
      setLoadingDivisions(false);
    }
    void loadDivisions();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);
  useEffect(() => {
    let cancelled = false;
    async function loadTable() {
      if (!selectedDivisionId) {
        setRows([]);
        return;
      }
      setLoadingTable(true);
      setError(null);
      const { data: standingsData, error: standingsError } =
        await supabase
          .from("standings")
          .select(
            "id,division_id,team_id,played,won,drawn,lost,goals_for,goals_against,goal_difference,points",
          )
          .eq(
            "division_id",
            selectedDivisionId,
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
      if (cancelled) return;
      if (standingsError) {
        console.error(
          "Failed to load standings:",
          standingsError,
        );
        setError("Failed to load standings.");
        setRows([]);
        setLoadingTable(false);
        return;
      }
      const standings = (standingsData ??
        []) as Standing[];
      if (standings.length === 0) {
        setRows([]);
        setLoadingTable(false);
        return;
      }
      const teamIds = standings.map(
        (standing) => standing.team_id,
      );
      const { data: teamsData, error: teamsError } =
        await supabase
          .from("teams")
          .select(
            "id,name,short_name,logo_url",
          )
          .in("id", teamIds);
      if (cancelled) return;
      if (teamsError) {
        console.error(
          "Failed to load teams:",
          teamsError,
        );
        setError("Failed to load teams.");
        setRows([]);
        setLoadingTable(false);
        return;
      }
      const teams = (teamsData ?? []) as Team[];
      const teamMap = new Map(
        teams.map((team) => [
          team.id,
          team,
        ]),
      );
      const combinedRows = standings.map(
        (standing) => ({
          ...standing,
          team:
            teamMap.get(standing.team_id) ??
            null,
        }),
      );
      setRows(combinedRows);
      setLoadingTable(false);
    }
    void loadTable();
    return () => {
      cancelled = true;
    };
  }, [selectedDivisionId]);
  function renderCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const height =
      HEADER_HEIGHT +
      rows.length * ROW_HEIGHT +
      FOOTER_HEIGHT;
    canvas.width = TABLE_WIDTH;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(
      0,
      0,
      TABLE_WIDTH,
      height,
    );
    /*
     * Background
     */
    ctx.fillStyle = "#09090b";
    ctx.fillRect(
      0,
      0,
      TABLE_WIDTH,
      height,
    );
    /*
     * Header
     */
    const headerGradient =
      ctx.createLinearGradient(
        0,
        0,
        TABLE_WIDTH,
        0,
      );
    headerGradient.addColorStop(
      0,
      "#18181b",
    );
    headerGradient.addColorStop(
      1,
      "#27272a",
    );
    ctx.fillStyle = headerGradient;
    ctx.fillRect(
      0,
      0,
      TABLE_WIDTH,
      HEADER_HEIGHT,
    );
    /*
     * NOVA branding
     */
    ctx.fillStyle = "#ffffff";
    ctx.font =
      "900 54px Arial, sans-serif";
    ctx.fillText(
      "NOVA",
      55,
      72,
    );
    ctx.fillStyle = "#a1a1aa";
    ctx.font =
      "700 20px Arial, sans-serif";
    ctx.fillText(
      "VRFS FOOTBALL",
      58,
      103,
    );
    /*
     * League title
     */
    ctx.fillStyle = "#ffffff";
    ctx.font =
      "800 38px Arial, sans-serif";
    ctx.fillText(
      leagueName || "League",
      55,
      158,
    );
    ctx.fillStyle = "#a1a1aa";
    ctx.font =
      "600 22px Arial, sans-serif";
    ctx.fillText(
      selectedDivision?.name ||
        "Division",
      55,
      193,
    );
    /*
     * Table header
     */
    const tableHeaderY =
      HEADER_HEIGHT;
    ctx.fillStyle = "#18181b";
    ctx.fillRect(
      0,
      tableHeaderY,
      TABLE_WIDTH,
      58,
    );
    ctx.fillStyle = "#71717a";
    ctx.font =
      "800 18px Arial, sans-serif";
    ctx.fillText(
      "#",
      55,
      tableHeaderY + 37,
    );
    ctx.fillText(
      "TEAM",
      125,
      tableHeaderY + 37,
    );
    const columns = [
      ["P", 720],
      ["W", 790],
      ["D", 860],
      ["L", 930],
      ["GF", 1000],
      ["GA", 1075],
      ["GD", 1150],
      ["PTS", 1230],
    ];
    for (const [label, x] of columns) {
      ctx.fillText(
        label,
        Number(x),
        tableHeaderY + 37,
      );
    }
    /*
     * Rows
     */
    rows.forEach((row, index) => {
      const y =
        HEADER_HEIGHT +
        58 +
        index * ROW_HEIGHT;
      if (index % 2 === 0) {
        ctx.fillStyle = "#0f0f12";
      } else {
        ctx.fillStyle = "#131316";
      }
      ctx.fillRect(
        0,
        y,
        TABLE_WIDTH,
        ROW_HEIGHT,
      );
      /*
       * Position
       */
      ctx.fillStyle =
        index === 0
          ? "#ffffff"
          : "#71717a";
      ctx.font =
        index === 0
          ? "900 28px Arial, sans-serif"
          : "800 24px Arial, sans-serif";
      ctx.fillText(
        String(index + 1),
        58,
        y + 64,
      );
      /*
       * Team logo
       */
      const logoX = 120;
      const logoY = y + 18;
      const logoSize = 68;
      if (row.team?.logo_url) {
        void loadImage(
          row.team.logo_url,
        )
          .then((image) => {
            const ratio = Math.min(
              logoSize / image.width,
              logoSize / image.height,
            );
            const width =
              image.width * ratio;
            const imageHeight =
              image.height * ratio;
            ctx.drawImage(
              image,
              logoX +
                (logoSize - width) / 2,
              logoY +
                (logoSize -
                  imageHeight) /
                  2,
              width,
              imageHeight,
            );
            ctx.fillStyle =
              "#ffffff";
            ctx.font =
              "800 25px Arial, sans-serif";
            ctx.fillText(
              row.team?.name ||
                "Unknown Team",
              215,
              y + 57,
            );
          })
          .catch(() => {
            drawFallbackTeam(
              ctx,
              row,
              logoX,
              logoY,
              logoSize,
              y,
            );
          });
      } else {
        drawFallbackTeam(
          ctx,
          row,
          logoX,
          logoY,
          logoSize,
          y,
        );
      }
      /*
       * Stats
       */
      const stats = [
        row.played,
        row.won,
        row.drawn,
        row.lost,
        row.goals_for,
        row.goals_against,
        row.goal_difference,
        row.points,
      ];
      const statX = [
        720,
        790,
        860,
        930,
        1000,
        1075,
        1150,
        1230,
      ];
      stats.forEach(
        (value, statIndex) => {
          ctx.fillStyle =
            statIndex === 7
              ? "#ffffff"
              : "#d4d4d8";
          ctx.font =
            statIndex === 7
              ? "900 27px Arial, sans-serif"
              : "700 22px Arial, sans-serif";
          ctx.fillText(
            String(value ?? 0),
            statX[statIndex],
            y + 58,
          );
        },
      );
      /*
       * Divider
       */
      ctx.fillStyle = "#27272a";
      ctx.fillRect(
        55,
        y + ROW_HEIGHT - 1,
        TABLE_WIDTH - 110,
        1,
      );
    });
    /*
     * Footer
     */
    const footerY =
      HEADER_HEIGHT +
      58 +
      rows.length * ROW_HEIGHT;
    ctx.fillStyle = "#09090b";
    ctx.fillRect(
      0,
      footerY,
      TABLE_WIDTH,
      FOOTER_HEIGHT,
    );
    ctx.fillStyle = "#52525b";
    ctx.font =
      "600 17px Arial, sans-serif";
    ctx.fillText(
      "Generated by NOVA • VRFS Football Statistics",
      55,
      footerY + 48,
    );
    /*
     * Logo loading is asynchronous, so repaint
     * once images have had a chance to load.
     */
    window.setTimeout(() => {
      if (canvasRef.current === canvas) {
        renderCanvas();
      }
    }, 150);
  }
  function drawFallbackTeam(
    ctx: CanvasRenderingContext2D,
    row: TableRow,
    x: number,
    y: number,
    size: number,
    rowY: number,
  ) {
    ctx.fillStyle = "#27272a";
    drawRoundedRect(
      ctx,
      x,
      y,
      size,
      size,
      14,
    );
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font =
      "900 21px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      getInitials(
        row.team?.short_name ||
          row.team?.name ||
          "FC",
      ),
      x + size / 2,
      y + 43,
    );
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font =
      "800 25px Arial, sans-serif";
    ctx.fillText(
      row.team?.name ||
        "Unknown Team",
      215,
      rowY + 57,
    );
  }
  useEffect(() => {
    if (rows.length > 0) {
      renderCanvas();
    }
  }, [
    rows,
    selectedDivision,
    leagueName,
  ]);
  async function generatePng() {
    const canvas = canvasRef.current;
    if (!canvas || rows.length === 0) {
      return;
    }
    setGenerating(true);
    try {
      /*
       * Give team logos a moment to finish loading
       * before exporting.
       */
      await new Promise((resolve) =>
        window.setTimeout(
          resolve,
          500,
        ),
      );
      renderCanvas();
      await new Promise((resolve) =>
        window.setTimeout(
          resolve,
          250,
        ),
      );
      const link =
        document.createElement("a");
      const safeLeagueName =
        (leagueName || "league")
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            "-",
          )
          .replace(
            /^-|-$/g,
            "",
          );
      const safeDivisionName =
        (
          selectedDivision?.name ||
          "division"
        )
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            "-",
          )
          .replace(
            /^-|-$/g,
            "",
          );
      link.download =
        `nova-${safeLeagueName}-${safeDivisionName}-table.png`;
      link.href =
        canvas.toDataURL(
          "image/png",
          1,
        );
      link.click();
    } catch (generationError) {
      console.error(
        "Failed to generate table:",
        generationError,
      );
      setError(
        "Failed to generate the table image.",
      );
    } finally {
      setGenerating(false);
    }
  }
  async function refresh() {
    if (!selectedDivisionId) return;
    setLoadingTable(true);
    setError(null);
    const { data: standingsData, error: standingsError } =
      await supabase
        .from("standings")
        .select(
          "id,division_id,team_id,played,won,drawn,lost,goals_for,goals_against,goal_difference,points",
        )
        .eq(
          "division_id",
          selectedDivisionId,
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
    if (standingsError) {
      setError(
        "Failed to refresh standings.",
      );
      setLoadingTable(false);
      return;
    }
    const standings =
      (standingsData ?? []) as Standing[];
    const teamIds = standings.map(
      (standing) => standing.team_id,
    );
    if (teamIds.length === 0) {
      setRows([]);
      setLoadingTable(false);
      return;
    }
    const { data: teamsData } =
      await supabase
        .from("teams")
        .select(
          "id,name,short_name,logo_url",
        )
        .in("id", teamIds);
    const teams =
      (teamsData ?? []) as Team[];
    const teamMap = new Map(
      teams.map((team) => [
        team.id,
        team,
      ]),
    );
    setRows(
      standings.map(
        (standing) => ({
          ...standing,
          team:
            teamMap.get(
              standing.team_id,
            ) ?? null,
        }),
      ),
    );
    setLoadingTable(false);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-950/70 p-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-400">
            <ImageIcon className="h-4 w-4" />
            Table Generator
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Generate league tables
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Turn the live NOVA standings into a
            branded PNG graphic.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedDivisionId}
            onChange={(event) =>
              setSelectedDivisionId(
                event.target.value,
              )
            }
            disabled={
              loadingDivisions ||
              divisions.length === 0
            }
            className="min-w-[220px] rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-white/30"
          >
            {loadingDivisions ? (
              <option value="">
                Loading divisions...
              </option>
            ) : divisions.length === 0 ? (
              <option value="">
                No divisions found
              </option>
            ) : (
              divisions.map(
                (division) => (
                  <option
                    key={division.id}
                    value={division.id}
                  >
                    {division.name}
                  </option>
                ),
              )
            )}
          </select>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={
              loadingTable ||
              !selectedDivisionId
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loadingTable
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </button>
        </div>
      </div>
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="font-bold text-white">
              {leagueName || "League"}{" "}
              {selectedDivision
                ? `• ${selectedDivision.name}`
                : ""}
            </p>
            <p className="text-sm text-zinc-500">
              {rows.length}{" "}
              {rows.length === 1
                ? "team"
                : "teams"}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              void generatePng()
            }
            disabled={
              generating ||
              loadingTable ||
              rows.length === 0
            }
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Generate PNG
          </button>
        </div>
        <div className="overflow-x-auto p-5">
          {loadingTable ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm font-semibold text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading live standings...
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <Trophy className="mb-4 h-10 w-10 text-zinc-600" />
              <p className="font-bold text-white">
                No standings yet
              </p>
              <p className="mt-1 max-w-md text-sm text-zinc-500">
                Once teams have standings in this
                division, the table generator will
                appear here.
              </p>
            </div>
          ) : (
            <div className="min-w-[1050px] overflow-hidden rounded-xl border border-white/10">
              <div className="grid grid-cols-[70px_minmax(280px,1fr)_70px_70px_70px_70px_80px_80px_80px_90px] items-center bg-zinc-900 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500">
                <span>#</span>
                <span>Team</span>
                <span>P</span>
                <span>W</span>
                <span>D</span>
                <span>L</span>
                <span>GF</span>
                <span>GA</span>
                <span>GD</span>
                <span>PTS</span>
              </div>
              {rows.map(
                (row, index) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[70px_minmax(280px,1fr)_70px_70px_70px_70px_80px_80px_80px_90px] items-center border-t border-white/5 bg-zinc-950 px-4 py-4"
                  >
                    <span className="font-black text-zinc-400">
                      {index + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      {row.team?.logo_url ? (
                        <img
                          src={
                            row.team.logo_url
                          }
                          alt=""
                          className="h-10 w-10 object-contain"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-xs font-black text-zinc-400">
                          {getInitials(
                            row.team
                              ?.short_name ||
                              row.team
                                ?.name ||
                              "FC",
                          )}
                        </div>
                      )}
                      <span className="font-bold text-white">
                        {row.team?.name ||
                          "Unknown Team"}
                      </span>
                    </div>
                    <span className="font-semibold text-zinc-300">
                      {row.played}
                    </span>
                    <span className="font-semibold text-zinc-300">
                      {row.won}
                    </span>
                    <span className="font-semibold text-zinc-300">
                      {row.drawn}
                    </span>
                    <span className="font-semibold text-zinc-300">
                      {row.lost}
                    </span>
                    <span className="font-semibold text-zinc-300">
                      {row.goals_for}
                    </span>
                    <span className="font-semibold text-zinc-300">
                      {row.goals_against}
                    </span>
                    <span className="font-semibold text-zinc-300">
                      {row.goal_difference}
                    </span>
                    <span className="font-black text-white">
                      {row.points}
                    </span>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">
                Image preview
              </p>
              <p className="text-xs text-zinc-500">
                This is the graphic that will be
                exported as PNG.
              </p>
            </div>
            <span className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-400">
              {TABLE_WIDTH} ×{" "}
              {HEADER_HEIGHT +
                58 +
                rows.length *
                  ROW_HEIGHT +
                FOOTER_HEIGHT}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black p-3">
            <canvas
              ref={canvasRef}
              className="mx-auto block h-auto max-w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
export default TableGenerator;
