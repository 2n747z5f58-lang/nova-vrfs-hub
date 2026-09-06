import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Copy,
  DollarSign,
  Loader2,
  Settings,
  Shield,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
type Team = {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  logo_url: string | null;
  description: string | null;
  budget: number | null;
  manager_id: string | null;
  league_id: string | null;
  division_id: string | null;
  created_at: string;
};
type Player = {
  id: string;
  name: string;
  position: string | null;
  avatar_url: string | null;
};
type Fixture = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  kickoff_at: string | null;
  competition: string | null;
  home_team?: { name: string } | null;
  away_team?: { name: string } | null;
};
type League = {
  id: string;
  name: string;
};
type Division = {
  id: string;
  name: string;
  league_id: string;
};
export const Route = createFileRoute("/team")({
  ssr: false,
  component: TeamPanel,
});
function TeamPanel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [division, setDivision] = useState<Division | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editShortName, setEditShortName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  useEffect(() => {
    void loadTeam();
  }, []);
  async function loadTeam() {
    setLoading(true);
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    setUserId(user.id);
    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select(
        "id, name, short_name, slug, logo_url, description, budget, manager_id, league_id, division_id, created_at",
      )
      .eq("manager_id", user.id)
      .maybeSingle();
    if (teamError) {
      console.error("Failed to load manager team:", teamError);
      setError("Couldn't load your team.");
      setLoading(false);
      return;
    }
    if (!teamData) {
      setTeam(null);
      setLoading(false);
      return;
    }
    const loadedTeam = teamData as Team;
    setTeam(loadedTeam);
    setEditName(loadedTeam.name);
    setEditShortName(loadedTeam.short_name ?? "");
    setEditLogoUrl(loadedTeam.logo_url ?? "");
    setEditDescription(loadedTeam.description ?? "");
    const [playersResult, fixturesResult] = await Promise.all([
      supabase
        .from("players")
        .select("id, name, position, avatar_url")
        .eq("team_id", loadedTeam.id)
        .order("name", { ascending: true }),
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
            competition,
            home_team:teams!fixtures_home_team_id_fkey (
              name
            ),
            away_team:teams!fixtures_away_team_id_fkey (
              name
            )
          `,
        )
        .or(
          `home_team_id.eq.${loadedTeam.id},away_team_id.eq.${loadedTeam.id}`,
        )
        .order("kickoff_at", { ascending: true }),
    ]);
    if (!playersResult.error) {
      setPlayers((playersResult.data ?? []) as Player[]);
    }
    if (!fixturesResult.error) {
      setFixtures((fixturesResult.data ?? []) as Fixture[]);
    }
    if (loadedTeam.league_id) {
      const { data: leagueData } = await supabase
        .from("leagues")
        .select("id, name")
        .eq("id", loadedTeam.league_id)
        .maybeSingle();
      setLeague((leagueData as League | null) ?? null);
    } else {
      setLeague(null);
    }
    if (loadedTeam.division_id) {
      const { data: divisionData } = await supabase
        .from("divisions")
        .select("id, name, league_id")
        .eq("id", loadedTeam.division_id)
        .maybeSingle();
      setDivision((divisionData as Division | null) ?? null);
    } else {
      setDivision(null);
    }
    setLoading(false);
  }
  function createSlug(value: string) {
    return (
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "team"
    );
  }
  async function createTeam() {
    if (!userId) return;
    setError("");
    setSuccess("");
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Enter a team name.");
      return;
    }
    if (cleanName.length < 2) {
      setError("Team name must be at least 2 characters.");
      return;
    }
    setCreating(true);
    const slug = `${createSlug(cleanName)}-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error: createError } = await supabase
      .from("teams")
      .insert({
        name: cleanName,
        short_name: shortName.trim() || null,
        slug,
        logo_url: logoUrl.trim() || null,
        description: description.trim() || null,
        manager_id: userId,
      })
      .select(
        "id, name, short_name, slug, logo_url, description, budget, manager_id, league_id, division_id, created_at",
      )
      .single();
    if (createError) {
      console.error("Failed to create team:", createError);
      if (createError.code === "23505") {
        setError("You already manage a NOVA team.");
      } else {
        setError(createError.message || "Couldn't create your team.");
      }
      setCreating(false);
      return;
    }
    setTeam(data as Team);
    setEditName(cleanName);
    setEditShortName(shortName.trim());
    setEditLogoUrl(logoUrl.trim());
    setEditDescription(description.trim());
    setName("");
    setShortName("");
    setLogoUrl("");
    setDescription("");
    setShowCreate(false);
    setSuccess("Your NOVA team has been created.");
    setCreating(false);
  }
  async function saveTeamSettings() {
    if (!team) return;
    const cleanName = editName.trim();
    if (!cleanName) {
      setError("Team name cannot be empty.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    const { data, error: updateError } = await supabase
      .from("teams")
      .update({
        name: cleanName,
        short_name: editShortName.trim() || null,
        logo_url: editLogoUrl.trim() || null,
        description: editDescription.trim() || null,
      })
      .eq("id", team.id)
      .eq("manager_id", userId)
      .select(
        "id, name, short_name, slug, logo_url, description, budget, manager_id, league_id, division_id, created_at",
      )
      .single();
    if (updateError) {
      console.error("Failed to update team:", updateError);
      setError(updateError.message || "Couldn't save team settings.");
      setSaving(false);
      return;
    }
    setTeam(data as Team);
    setSuccess("Team settings saved.");
    setSaving(false);
  }
  async function copyTeamLink() {
    if (!team) return;
    const url = `${window.location.origin}/teams/${team.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setSuccess("Team link copied.");
    } catch {
      setError("Couldn't copy the team link.");
    }
  }
  function formatDate(date: string | null) {
    if (!date) return "TBC";
    return new Date(date).toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  function formatMoney(value: number | null) {
    return `£${Number(value ?? 0).toLocaleString()}`;
  }
  const completedFixtures = useMemo(
    () =>
      fixtures.filter(
        (fixture) =>
          fixture.status === "completed" ||
          fixture.home_score !== null ||
          fixture.away_score !== null,
      ),
    [fixtures],
  );
  const upcomingFixtures = useMemo(
    () =>
      fixtures
        .filter(
          (fixture) =>
            fixture.status !== "completed" &&
            fixture.home_score === null &&
            fixture.away_score === null,
        )
        .slice(0, 10),
    [fixtures],
  );
  if (loading) {
    return (
      <main className="min-h-screen bg-background px-5 py-10">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }
  if (!team) {
    return (
      <main className="min-h-screen bg-background px-5 py-10 text-foreground">
        <div className="mx-auto flex min-h-[75vh] max-w-3xl items-center justify-center">
          <div className="w-full rounded-2xl border bg-card p-8 text-center md:p-12">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Shield className="size-7" />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              NOVA / Team Management
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">
              You don't have a team yet
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Create your NOVA team and manage your squad, staff, fixtures,
              budget and transfers from one place.
            </p>
            {error && (
              <div className="mx-auto mt-6 max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {!showCreate ? (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Create Team
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <div className="mx-auto mt-8 max-w-xl text-left">
                <div className="space-y-5">
                  <Field
                    label="Team name"
                    value={name}
                    onChange={setName}
                    placeholder="e.g. Inter Villa FC"
                  />
                  <Field
                    label="Short name"
                    value={shortName}
                    onChange={setShortName}
                    placeholder="e.g. IVF"
                    maxLength={6}
                  />
                  <Field
                    label="Logo URL"
                    value={logoUrl}
                    onChange={setLogoUrl}
                    placeholder="Optional logo image URL"
                  />
                  <div>
                    <label className="text-sm font-medium">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Tell people about your team..."
                      rows={4}
                      className="mt-2 w-full resize-none rounded-lg border bg-background px-3 py-3 text-sm outline-none transition focus:border-primary"
                    />
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs leading-5 text-muted-foreground">
                    Your team will be created on NOVA without a league or
                    division. A league overseer must separately confirm your
                    team into a division.
                  </div>
                  {error && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreate(false);
                        setError("");
                      }}
                      className="flex-1 rounded-lg border px-4 py-3 text-sm font-semibold transition hover:bg-accent"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void createTeam()}
                      disabled={creating}
                      className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {creating ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="size-4 animate-spin" />
                          Creating...
                        </span>
                      ) : (
                        "Create Team"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }
  const sections = [
    { id: "overview", label: "Overview", icon: Shield },
    { id: "squad", label: "Squad", icon: Users },
    { id: "staff", label: "Staff", icon: Users },
    { id: "fixtures", label: "Fixtures", icon: CalendarDays },
    { id: "results", label: "Results", icon: Trophy },
    { id: "budget", label: "Budget", icon: DollarSign },
    { id: "transfers", label: "Transfers", icon: ArrowRight },
    { id: "settings", label: "Team Settings", icon: Settings },
  ];
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            NOVA / Team Management
          </p>
          <div className="mt-3 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                Team Panel
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage your team and everything around it.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyTeamLink()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-accent"
            >
              <Copy className="size-4" />
              Copy Team Link
            </button>
          </div>
        </div>
        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="h-fit rounded-xl border bg-card p-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(section.id);
                    setError("");
                    setSuccess("");
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {section.label}
                </button>
              );
            })}
          </aside>
          <section className="min-w-0">
            {activeSection === "overview" && (
              <div className="space-y-6">
                <div className="rounded-xl border bg-card p-6 md:p-8">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                    <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-muted">
                      {team.logo_url ? (
                        <img
                          src={team.logo_url}
                          alt={team.name}
                          className="size-full object-contain p-3"
                        />
                      ) : (
                        <span className="text-3xl font-bold text-muted-foreground">
                          {team.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Team
                      </p>
                      <h2 className="mt-2 text-3xl font-bold">
                        {team.name}
                      </h2>
                      {team.short_name && (
                        <p className="mt-1 text-sm font-medium text-muted-foreground">
                          {team.short_name}
                        </p>
                      )}
                      <p className="mt-3 text-sm text-muted-foreground">
                        {team.description ||
                          "No team description has been added yet."}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    icon={Users}
                    label="Squad"
                    value={players.length.toString()}
                  />
                  <StatCard
                    icon={CalendarDays}
                    label="Fixtures"
                    value={fixtures.length.toString()}
                  />
                  <StatCard
                    icon={Trophy}
                    label="Results"
                    value={completedFixtures.length.toString()}
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Budget"
                    value={formatMoney(team.budget)}
                  />
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border bg-card p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      League status
                    </p>
                    {league && division ? (
                      <div className="mt-5">
                        <h3 className="text-xl font-bold">
                          {league.name}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {division.name}
                        </p>
                        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="size-3.5" />
                          Confirmed
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5">
                        <h3 className="text-xl font-bold">
                          Not in a league
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Your team exists on NOVA, but hasn't been confirmed
                          into a league division yet.
                        </p>
                        <div className="mt-5 rounded-lg border bg-muted/30 px-4 py-3 text-xs leading-5 text-muted-foreground">
                          League overseers choose teams from the central NOVA
                          team database and confirm them into their divisions.
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border bg-card p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Team link
                    </p>
                    <h3 className="mt-2 text-xl font-bold">
                      Share your NOVA team
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Your team has a permanent public page. The link can be
                      given to league overseers for identification, but it is
                      not required for league entry.
                    </p>
                    <button
                      type="button"
                      onClick={() => void copyTeamLink()}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-accent"
                    >
                      <Copy className="size-4" />
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeSection === "squad" && (
              <PanelCard
                eyebrow="Squad"
                title="Your players"
                description="Players currently registered to your NOVA team."
              >
                {players.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No players yet"
                    description="Players registered to your team will appear here."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {players.map((player) => (
                      <Link
                        key={player.id}
                        to="/players/$playerId"
                        params={{ playerId: player.id }}
                        className="flex items-center gap-3 rounded-xl border p-4 transition hover:bg-accent"
                      >
                        <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted">
                          {player.avatar_url ? (
                            <img
                              src={player.avatar_url}
                              alt={player.name}
                              className="size-full object-cover"
                            />
                          ) : (
                            <span className="font-bold text-muted-foreground">
                              {player.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {player.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {player.position ?? "Position not set"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </PanelCard>
            )}
            {activeSection === "staff" && (
              <PanelCard
                eyebrow="Staff"
                title="Team staff"
                description="Manage the people responsible for your team."
              >
                <EmptyState
                  icon={Users}
                  title="Staff management is next"
                  description="The Team Panel foundation is ready. Staff roles and permissions will be connected here."
                />
              </PanelCard>
            )}
            {activeSection === "fixtures" && (
              <PanelCard
                eyebrow="Schedule"
                title="Upcoming fixtures"
                description="Matches currently scheduled for your team."
              >
                {upcomingFixtures.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="No upcoming fixtures"
                    description="Fixtures will appear here when your team is entered into a competition."
                  />
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    {upcomingFixtures.map((fixture, index) => (
                      <div
                        key={fixture.id}
                        className={`p-5 ${
                          index !== upcomingFixtures.length - 1
                            ? "border-b"
                            : ""
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold">
                              {fixture.home_team?.name ?? "Home team"} vs{" "}
                              {fixture.away_team?.name ?? "Away team"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {fixture.competition ?? "Competition"} •{" "}
                              {formatDate(fixture.kickoff_at)}
                            </p>
                          </div>
                          <span className="rounded-full border px-3 py-1 text-xs font-medium">
                            {fixture.status ?? "Scheduled"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PanelCard>
            )}
            {activeSection === "results" && (
              <PanelCard
                eyebrow="History"
                title="Results"
                description="Completed matches involving your team."
              >
                {completedFixtures.length === 0 ? (
                  <EmptyState
                    icon={Trophy}
                    title="No results yet"
                    description="Completed matches will appear here."
                  />
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    {completedFixtures.map((fixture, index) => (
                      <div
                        key={fixture.id}
                        className={`p-5 ${
                          index !== completedFixtures.length - 1
                            ? "border-b"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {fixture.home_team?.name ?? "Home team"} vs{" "}
                              {fixture.away_team?.name ?? "Away team"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(fixture.kickoff_at)}
                            </p>
                          </div>
                          <p className="shrink-0 text-xl font-bold">
                            {fixture.home_score ?? 0} -{" "}
                            {fixture.away_score ?? 0}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PanelCard>
            )}
            {activeSection === "budget" && (
              <PanelCard
                eyebrow="Finance"
                title="Team budget"
                description="Your current available transfer budget."
              >
                <div className="rounded-xl border bg-muted/20 p-8 text-center">
                  <DollarSign className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Available budget
                  </p>
                  <p className="mt-2 text-5xl font-bold tracking-tight">
                    {formatMoney(team.budget)}
                  </p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                    Your league's transfer rules and overseer settings will
                    determine how this budget can be used.
                  </p>
                </div>
              </PanelCard>
            )}
            {activeSection === "transfers" && (
              <PanelCard
                eyebrow="Transfers"
                title="Team transfers"
                description="Manage incoming and outgoing player business."
              >
                <EmptyState
                  icon={ArrowRight}
                  title="Transfer management is next"
                  description="The Team Panel is connected to the real team database. Transfer actions will be added here with league-specific rules and budgets."
                />
              </PanelCard>
            )}
            {activeSection === "settings" && (
              <PanelCard
                eyebrow="Settings"
                title="Team settings"
                description="Update the public information for your NOVA team."
              >
                <div className="max-w-2xl space-y-5">
                  <Field
                    label="Team name"
                    value={editName}
                    onChange={setEditName}
                    placeholder="Team name"
                  />
                  <Field
                    label="Short name"
                    value={editShortName}
                    onChange={setEditShortName}
                    placeholder="Short name"
                    maxLength={6}
                  />
                  <Field
                    label="Logo URL"
                    value={editLogoUrl}
                    onChange={setEditLogoUrl}
                    placeholder="Logo image URL"
                  />
                  <div>
                    <label className="text-sm font-medium">
                      Description
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(event) =>
                        setEditDescription(event.target.value)
                      }
                      rows={5}
                      placeholder="Describe your team..."
                      className="mt-2 w-full resize-none rounded-lg border bg-background px-3 py-3 text-sm outline-none transition focus:border-primary"
                    />
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs leading-5 text-muted-foreground">
                    League and division membership cannot be changed here.
                    Those are controlled by the relevant league overseer.
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveTeamSettings()}
                    disabled={saving}
                    className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </PanelCard>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-2 w-full rounded-lg border bg-background px-3 py-3 text-sm outline-none transition focus:border-primary"
      />
    </div>
  );
}
function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold">{value}</p>
    </div>
  );
}
function PanelCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-14 text-center">
      <Icon className="mx-auto size-8 text-muted-foreground" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
