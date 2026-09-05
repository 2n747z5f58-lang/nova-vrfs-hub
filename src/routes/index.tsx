import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronRight,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NovaHeader, NovaSidebar } from "../components/nova/NovaSidebar";
type Team = {
  id: string;
  name: string;
  logo_url: string | null;
};
type Fixture = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  kickoff_at: string | null;
  gameweek: number | null;
  competition: string | null;
  matchday_graphic_url: string | null;
  home_team: Team | null;
  away_team: Team | null;
};
type Result = {
  id: string;
  fixture_id: string;
  home_score: number;
  away_score: number;
  completed_at: string | null;
  fixture: Fixture | null;
};
type League = {
  id: string;
  name: string;
};
type Transfer = {
  id: string;
  transfer_date: string | null;
  details: string | null;
  fee: number | null;
  status: string | null;
  completed_at: string | null;
  player: {
    id: string;
    display_name: string | null;
    username: string | null;
  } | null;
  from_team: Team | null;
  to_team: Team | null;
};
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" as any });
    }
  },
  head: () => ({
    meta: [
      { title: "NOVA — VRFS" },
      {
        name: "description",
        content:
          "NOVA is the professional statistics and league-management platform for VRFS.",
      },
    ],
  }),
  component: Index,
});
function Index() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<
    "yesterday" | "today" | "tomorrow"
  >("today");
  useEffect(() => {
    loadHomeData();
  }, []);
  async function loadHomeData() {
    setLoading(true);
    setError(null);
    const [
      fixturesResponse,
      resultsResponse,
      leaguesResponse,
      transfersResponse,
      teamsResponse,
      playersResponse,
    ] = await Promise.all([
      supabase
        .from("fixtures")
        .select(
          `
            id,
            home_team_id,
            away_team_id,
            home_score,
            away_score,
            status,
            kickoff_at,
            gameweek,
            competition,
            matchday_graphic_url,
            home_team:teams!fixtures_home_team_id_fkey(
              id,
              name,
              logo_url
            ),
            away_team:teams!fixtures_away_team_id_fkey(
              id,
              name,
              logo_url
            )
          `,
        )
        .order("kickoff_at", { ascending: true }),
      supabase
        .from("results")
        .select(
          `
            id,
            fixture_id,
            home_score,
            away_score,
            completed_at,
            fixture:fixtures(
              id,
              home_team_id,
              away_team_id,
              home_score,
              away_score,
              status,
              kickoff_at,
              gameweek,
              competition,
              matchday_graphic_url,
              home_team:teams!fixtures_home_team_id_fkey(
                id,
                name,
                logo_url
              ),
              away_team:teams!fixtures_away_team_id_fkey(
                id,
                name,
                logo_url
              )
            )
          `,
        )
        .order("completed_at", { ascending: false })
        .limit(8),
      supabase
        .from("leagues")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(6),
      supabase
        .from("transfers")
        .select(
          `
            id,
            transfer_date,
            details,
            fee,
            status,
            completed_at,
            player:players(
              id,
              display_name,
              username
            ),
            from_team:teams!transfers_from_team_id_fkey(
              id,
              name,
              logo_url
            ),
            to_team:teams!transfers_to_team_id_fkey(
              id,
              name,
              logo_url
            )
          `,
        )
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("teams").select("id", { count: "exact", head: true }),
      supabase.from("players").select("id", { count: "exact", head: true }),
    ]);
    const firstError =
      fixturesResponse.error ??
      resultsResponse.error ??
      leaguesResponse.error ??
      transfersResponse.error ??
      teamsResponse.error ??
      playersResponse.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setFixtures((fixturesResponse.data ?? []) as unknown as Fixture[]);
    setResults((resultsResponse.data ?? []) as unknown as Result[]);
    setLeagues((leaguesResponse.data ?? []) as League[]);
    setTransfers((transfersResponse.data ?? []) as unknown as Transfer[]);
    setTeamCount(teamsResponse.count ?? 0);
    setPlayerCount(playersResponse.count ?? 0);
    setLoading(false);
  }
  const now = Date.now();
  const upcomingFixtures = useMemo(
    () =>
      fixtures
        .filter(
          (fixture) =>
            fixture.kickoff_at &&
            new Date(fixture.kickoff_at).getTime() >= now &&
            !isCompleted(fixture),
        )
        .sort(
          (a, b) =>
            new Date(a.kickoff_at!).getTime() -
            new Date(b.kickoff_at!).getTime(),
        ),
    [fixtures, now],
  );
  const featuredMatch = upcomingFixtures[0] ?? null;
  const selectedDateFixtures = useMemo(() => {
    const offset =
      selectedDay === "yesterday"
        ? -1
        : selectedDay === "tomorrow"
          ? 1
          : 0;
    return fixtures
      .filter((fixture) => isSameCalendarDay(fixture.kickoff_at, offset))
      .sort(
        (a, b) =>
          new Date(a.kickoff_at ?? 0).getTime() -
          new Date(b.kickoff_at ?? 0).getTime(),
      );
  }, [fixtures, selectedDay]);
  const liveFixtures = fixtures.filter((fixture) => isLive(fixture));
  const recentResults = results
    .filter((result) => result.fixture)
    .sort(
      (a, b) =>
        new Date(b.completed_at ?? 0).getTime() -
        new Date(a.completed_at ?? 0).getTime(),
    )
    .slice(0, 5);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <NovaSidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <div className="min-w-0 flex-1">
          <NovaHeader onMenu={() => setMobileOpen(true)} />
          <main
            id="main"
            className="mx-auto max-w-[1500px] px-5 pb-16 pt-6 lg:px-10"
          >
            {error && (
              <div className="mb-6 border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
                {error}
              </div>
            )}
            <FeaturedMatch
              fixture={featuredMatch}
              liveFixtures={liveFixtures}
            />
            <section className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                VRFS / Match Centre
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Match Centre
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Fixtures, results and live action from across the VRFS
                competitive scene.
              </p>
            </section>
            <section className="mb-8 grid grid-cols-2 border-y border-border md:grid-cols-4">
              <Stat
                icon={Trophy}
                label="Active leagues"
                value={leagues.length}
              />
              <Stat
                icon={CalendarDays}
                label="Fixtures tracked"
                value={fixtures.length}
              />
              <Stat
                icon={Users}
                label="Registered teams"
                value={teamCount}
              />
              <Stat
                icon={ShieldCheck}
                label="Players indexed"
                value={playerCount}
              />
            </section>
            <section className="mb-10">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Matchday
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight">
                    Fixtures & results
                  </h2>
                </div>
                <Link
                  to={"/fixtures" as any}
                  className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  All fixtures
                  <ChevronRight className="ml-1 inline size-3" />
                </Link>
              </div>
              <div className="mb-6 flex border-b border-border">
                <DayButton
                  active={selectedDay === "yesterday"}
                  onClick={() => setSelectedDay("yesterday")}
                >
                  Yesterday
                </DayButton>
                <DayButton
                  active={selectedDay === "today"}
                  onClick={() => setSelectedDay("today")}
                >
                  Today
                </DayButton>
                <DayButton
                  active={selectedDay === "tomorrow"}
                  onClick={() => setSelectedDay("tomorrow")}
                >
                  Tomorrow
                </DayButton>
              </div>
              {loading ? (
                <LoadingRows />
              ) : selectedDateFixtures.length === 0 ? (
                <EmptyState text="No fixtures scheduled for this day." />
              ) : (
                <FixtureGroups fixtures={selectedDateFixtures} />
              )}
            </section>
            <section className="mb-10">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Finished
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight">
                    Recent results
                  </h2>
                </div>
                <Link
                  to={"/results" as any}
                  className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  All results
                  <ChevronRight className="ml-1 inline size-3" />
                </Link>
              </div>
              {recentResults.length === 0 ? (
                <EmptyState text="No completed results yet." />
              ) : (
                <div className="divide-y divide-border border-y border-border">
                  {recentResults.map((result) => (
                    <ResultRow key={result.id} result={result} />
                  ))}
                </div>
              )}
            </section>
            <div className="grid gap-10 lg:grid-cols-2">
              <section>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Competitions
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight">
                      Featured leagues
                    </h2>
                  </div>
                  <Link
                    to={"/leagues" as any}
                    className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                  >
                    View all
                    <ChevronRight className="ml-1 inline size-3" />
                  </Link>
                </div>
                {leagues.length === 0 ? (
                  <EmptyState text="No leagues created yet." />
                ) : (
                  <div className="divide-y divide-border border-y border-border">
                    {leagues.map((league) => (
                      <Link
                        key={league.id}
                        to={"/leagues/$leagueId" as any}
                        params={{ leagueId: league.id }}
                        className="flex items-center justify-between py-4 transition hover:bg-muted/30"
                      >
                        <span className="font-semibold">{league.name}</span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}
              </section>
              <section>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Market
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight">
                      Recent transfers
                    </h2>
                  </div>
                  <Link
                    to={"/transfers" as any}
                    className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                  >
                    View all
                    <ChevronRight className="ml-1 inline size-3" />
                  </Link>
                </div>
                {transfers.length === 0 ? (
                  <EmptyState text="No transfers yet." />
                ) : (
                  <div className="divide-y divide-border border-y border-border">
                    {transfers.map((transfer) => (
                      <div key={transfer.id} className="py-4">
                        <p className="font-semibold">
                          {transfer.player?.display_name ??
                            transfer.player?.username ??
                            "Unknown player"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {transfer.from_team?.name ?? "Free agent"}
                          <span className="mx-2">→</span>
                          {transfer.to_team?.name ?? "Unknown team"}
                        </p>
                        {transfer.details && (
                          <p className="mt-1 text-xs text-muted-foreground/70">
                            {transfer.details}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
function FeaturedMatch({
  fixture,
  liveFixtures,
}: {
  fixture: Fixture | null;
  liveFixtures: Fixture[];
}) {
  const liveMatch = liveFixtures[0];
  const match = liveMatch ?? fixture;
  const [timeLeft, setTimeLeft] = useState(
    match?.kickoff_at
      ? getTimeLeft(new Date(match.kickoff_at).getTime())
      : 0,
  );
  useEffect(() => {
    if (!match?.kickoff_at || isLive(match) || isCompleted(match)) {
      setTimeLeft(0);
      return;
    }
    const update = () => {
      setTimeLeft(getTimeLeft(new Date(match.kickoff_at!).getTime()));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [match?.id, match?.kickoff_at]);
  if (!match) {
    return (
      <section className="mb-12 border-y border-border py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Match Centre
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight">
          No upcoming match
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The next scheduled fixture will appear here automatically.
        </p>
      </section>
    );
  }
  const ongoing = isLive(match);
  const completed = isCompleted(match);
  return (
    <section className="relative -mx-5 mb-12 overflow-hidden sm:-mx-8 lg:-mx-10">
      {match.matchday_graphic_url ? (
        <div className="group relative overflow-hidden">
          <img
            src={match.matchday_graphic_url}
            alt={`${match.home_team?.name ?? ""} vs ${
              match.away_team?.name ?? ""
            }`}
            className="block h-auto w-full object-contain transition-transform duration-700 ease-out group-hover:scale-[1.015]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>
      ) : (
        <div className="h-[220px] border-y border-border bg-muted/10 sm:h-[320px]" />
      )}
      <div className="relative -mt-20 px-5 sm:-mt-28 sm:px-8 lg:-mt-36 lg:px-10">
        {ongoing ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-red-500">
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
            Ongoing
          </div>
        ) : (
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
            Match Centre
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          {match.home_team && (
            <>
              <TeamBadge team={match.home_team} />
              <h2 className="text-2xl font-black uppercase tracking-[-0.05em] sm:text-4xl lg:text-5xl">
                {match.home_team.name}
              </h2>
            </>
          )}
          {(ongoing || completed) && (
            <span className="text-2xl font-black sm:text-4xl">
              {match.home_score ?? 0} - {match.away_score ?? 0}
            </span>
          )}
          {!ongoing && !completed && (
            <span className="text-sm font-bold text-muted-foreground sm:text-lg">
              VS
            </span>
          )}
          {match.away_team && (
            <>
              <h2 className="text-2xl font-black uppercase tracking-[-0.05em] sm:text-4xl lg:text-5xl">
                {match.away_team.name}
              </h2>
              <TeamBadge team={match.away_team} />
            </>
          )}
        </div>
        {match.competition && (
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em]">
            {match.competition}
          </p>
        )}
        {match.kickoff_at && (
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {formatKickoff(match.kickoff_at)}
          </p>
        )}
        {!ongoing && !completed && (
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Kickoff countdown
            </p>
            <p className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              {formatTimeLeft(timeLeft)}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
function FixtureGroups({ fixtures }: { fixtures: Fixture[] }) {
  const groups = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const league = fixture.competition?.trim() || "Other competitions";
    if (!groups.has(league)) {
      groups.set(league, []);
    }
    groups.get(league)!.push(fixture);
  }
  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([league, leagueFixtures]) => (
        <div key={league}>
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">{league}</h3>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {leagueFixtures.map((fixture) => (
              <FixtureRow key={fixture.id} fixture={fixture} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
function FixtureRow({ fixture }: { fixture: Fixture }) {
  const ongoing = isLive(fixture);
  const completed = isCompleted(fixture);
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3 text-right">
        {fixture.home_team && (
          <>
            <span className="truncate text-sm font-semibold">
              {fixture.home_team.name}
            </span>
            <TeamBadge team={fixture.home_team} small />
          </>
        )}
      </div>
      <div className="min-w-[72px] text-center">
        {ongoing && (
          <p className="mb-1 animate-pulse text-[9px] font-black uppercase tracking-[0.18em] text-red-500">
            Ongoing
          </p>
        )}
        {completed ? (
          <span className="text-sm font-black">
            {fixture.home_score ?? 0} - {fixture.away_score ?? 0}
          </span>
        ) : (
          <span className="text-xs font-bold text-muted-foreground">
            {fixture.kickoff_at
              ? new Date(fixture.kickoff_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "TBC"}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {fixture.away_team && (
          <>
            <TeamBadge team={fixture.away_team} small />
            <span className="truncate text-sm font-semibold">
              {fixture.away_team.name}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
function ResultRow({ result }: { result: Result }) {
  const fixture = result.fixture;
  if (!fixture) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3 text-right">
        {fixture.home_team && (
          <>
            <span className="truncate text-sm font-semibold">
              {fixture.home_team.name}
            </span>
            <TeamBadge team={fixture.home_team} small />
          </>
        )}
      </div>
      <div className="text-sm font-black">
        {result.home_score} - {result.away_score}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {fixture.away_team && (
          <>
            <TeamBadge team={fixture.away_team} small />
            <span className="truncate text-sm font-semibold">
              {fixture.away_team.name}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
function TeamBadge({
  team,
  small = false,
}: {
  team: Team | null;
  small?: boolean;
}) {
  if (!team) return null;
  if (!team.logo_url) {
    return (
      <div
        className={`shrink-0 rounded-full border border-border bg-muted/30 ${
          small ? "size-7" : "size-12"
        }`}
      />
    );
  }
  return (
    <img
      src={team.logo_url}
      alt=""
      className={`shrink-0 object-contain ${
        small ? "size-7" : "size-12 sm:size-16"
      }`}
    />
  );
}
function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: number;
}) {
  return (
    <div className="px-4 py-5 sm:px-5">
      <Icon className="mb-3 size-4 text-muted-foreground" />
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
function DayButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] transition ${
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
function EmptyState({ text }: { text: string }) {
  return (
    <div className="border-y border-border py-12 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
function LoadingRows() {
  return (
    <div className="divide-y divide-border border-y border-border">
      {[1, 2, 3].map((item) => (
        <div key={item} className="flex items-center justify-between py-5">
          <div className="h-4 w-32 animate-pulse bg-muted" />
          <div className="h-4 w-12 animate-pulse bg-muted" />
          <div className="h-4 w-32 animate-pulse bg-muted" />
        </div>
      ))}
    </div>
  );
}
function isCompleted(fixture: Fixture) {
  const status = (fixture.status ?? "").toLowerCase();
  return (
    status === "completed" ||
    status === "finished" ||
    status === "full_time" ||
    status === "ft" ||
    (fixture.home_score !== null && fixture.away_score !== null)
  );
}
function isLive(fixture: Fixture) {
  const status = (fixture.status ?? "").toLowerCase();
  return (
    status === "live" ||
    status === "ongoing" ||
    status === "in_progress" ||
    status === "in-progress"
  );
}
function isSameCalendarDay(
  dateString: string | null,
  offset: number,
): boolean {
  if (!dateString) return false;
  const target = new Date();
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + offset);
  const date = new Date(dateString);
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}
function getTimeLeft(target: number) {
  return Math.max(0, target - Date.now());
}
function formatTimeLeft(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${String(days).padStart(2, "0")}:${String(hours).padStart(
      2,
      "0",
    )}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0",
    )}`;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
}
function formatKickoff(dateString: string) {
  return new Date(dateString).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
