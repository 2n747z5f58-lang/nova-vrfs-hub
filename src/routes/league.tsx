import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
type League = {
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
};
type Division = {
  id: string;
  name: string;
  league_id: string;
};
type Team = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  league_id: string | null;
  division_id: string | null;
  manager_id: string | null;
  budget: number | null;
};
type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};
export const Route = createFileRoute("/league")({
  ssr: false,
  component: LeaguePanel,
});
function LeaguePanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [league, setLeague] = useState<League | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [activeSection, setActiveSection] = useState<
    "overview" | "divisions" | "teams"
  >("overview");
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("");
  const [teamSearch, setTeamSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Team[]>([]);
  const [searchingTeams, setSearchingTeams] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void loadPanel();
  }, []);
  async function loadPanel() {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        void navigate({ to: "/auth" });
        return;
      }
      const { data: membership, error: membershipError } = await supabase
        .from("league_members")
        .select("league_id,role")
        .eq("user_id", user.id)
        .in("role", ["overseer", "co_overseer"])
        .limit(1)
        .maybeSingle();
      if (membershipError) {
        throw membershipError;
      }
      let leagueId = membership?.league_id ?? null;
      if (!leagueId) {
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (adminRole) {
          const { data: firstLeague, error: firstLeagueError } =
            await supabase
              .from("leagues")
              .select("id")
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
          if (firstLeagueError) {
            throw firstLeagueError;
          }
          leagueId = firstLeague?.id ?? null;
        }
      }
      if (!leagueId) {
        setError(
          "You are not an overseer or co-overseer for a NOVA league."
        );
        setLoading(false);
        return;
      }
      const [
        { data: leagueData, error: leagueError },
        { data: divisionData, error: divisionError },
        { data: teamData, error: teamError },
      ] = await Promise.all([
        supabase
          .from("leagues")
          .select("id,name,slug,status")
          .eq("id", leagueId)
          .single(),
        supabase
          .from("divisions")
          .select("id,name,league_id")
          .eq("league_id", leagueId)
          .order("name", { ascending: true }),
        supabase
          .from("teams")
          .select(
            "id,name,short_name,logo_url,league_id,division_id,manager_id,budget"
          )
          .eq("league_id", leagueId)
          .order("name", { ascending: true }),
      ]);
      if (leagueError) throw leagueError;
      if (divisionError) throw divisionError;
      if (teamError) throw teamError;
      setLeague(leagueData);
      setDivisions(divisionData ?? []);
      setTeams(teamData ?? []);
      if (divisionData && divisionData.length > 0) {
        setSelectedDivisionId(divisionData[0].id);
      }
      const managerIds = [
        ...new Set(
          (teamData ?? [])
            .map((team) => team.manager_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];
      if (managerIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .in("id", managerIds);
        const profileMap: Record<string, Profile> = {};
        for (const profile of profileData ?? []) {
          profileMap[profile.id] = profile;
        }
        setProfiles(profileMap);
      }
    } catch (err) {
      console.error("Failed to load league panel:", err);
      setError("Couldn't load the league panel.");
    } finally {
      setLoading(false);
    }
  }
  async function searchTeams(query: string) {
    setTeamSearch(query);
    setSelectedTeam(null);
    setMessage(null);
    setError(null);
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    setSearchingTeams(true);
    const { data, error: searchError } = await supabase
      .from("teams")
      .select(
        "id,name,short_name,logo_url,league_id,division_id,manager_id,budget"
      )
      .or(`name.ilike.%${trimmed}%,short_name.ilike.%${trimmed}%`)
      .order("name", { ascending: true })
      .limit(20);
    if (searchError) {
      console.error("Failed to search teams:", searchError);
      setError("Couldn't search teams.");
      setSearchResults([]);
      setSearchingTeams(false);
      return;
    }
    setSearchResults(data ?? []);
    setSearchingTeams(false);
  }
  async function confirmTeam() {
    if (!league || !selectedTeam || !selectedDivisionId) {
      setError("Select a team and division first.");
      return;
    }
    const division = divisions.find(
      (item) => item.id === selectedDivisionId
    );
    if (!division) {
      setError("That division could not be found.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("teams")
      .update({
        league_id: league.id,
        division_id: division.id,
      })
      .eq("id", selectedTeam.id)
      .select(
        "id,name,short_name,logo_url,league_id,division_id,manager_id,budget"
      )
      .single();
    if (updateError) {
      console.error("Failed to confirm team:", updateError);
      setError(
        updateError.message ||
          "Couldn't add that team to the division."
      );
      setSaving(false);
      return;
    }
    setTeams((current) => {
      const withoutExisting = current.filter(
        (team) => team.id !== data.id
      );
      return [...withoutExisting, data].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    });
    setSearchResults((current) =>
      current.map((team) => (team.id === data.id ? data : team))
    );
    setSelectedTeam(data);
    setMessage(
      `${data.name} is now confirmed in ${division.name}.`
    );
    setSaving(false);
  }
  async function removeTeam(team: Team) {
    if (!league) return;
    const confirmed = window.confirm(
      `Remove ${team.name} from ${league.name}?`
    );
    if (!confirmed) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    const { error: updateError } = await supabase
      .from("teams")
      .update({
        league_id: null,
        division_id: null,
      })
      .eq("id", team.id)
      .eq("league_id", league.id);
    if (updateError) {
      console.error("Failed to remove team:", updateError);
      setError(
        updateError.message ||
          "Couldn't remove that team from the league."
      );
      setSaving(false);
      return;
    }
    setTeams((current) =>
      current.filter((item) => item.id !== team.id)
    );
    setSearchResults((current) =>
      current.map((item) =>
        item.id === team.id
          ? {
              ...item,
              league_id: null,
              division_id: null,
            }
          : item
      )
    );
    if (selectedTeam?.id === team.id) {
      setSelectedTeam(null);
    }
    setMessage(`${team.name} was removed from the league.`);
    setSaving(false);
  }
  const selectedDivision = divisions.find(
    (division) => division.id === selectedDivisionId
  );
  const teamsInSelectedDivision = useMemo(() => {
    if (!selectedDivisionId) return [];
    return teams
      .filter((team) => team.division_id === selectedDivisionId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, selectedDivisionId]);
  const unassignedSearchResults = useMemo(() => {
    return searchResults.filter(
      (team) => !team.league_id || team.league_id === league?.id
    );
  }, [searchResults, league]);
  const divisionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const division of divisions) {
      counts[division.id] = teams.filter(
        (team) => team.division_id === division.id
      ).length;
    }
    return counts;
  }, [divisions, teams]);
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading league panel...
        </div>
      </main>
    );
  }
  if (error && !league) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10">
            <Shield className="size-5 text-destructive" />
          </div>
          <h1 className="mt-5 text-xl font-bold">
            League access required
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/leagues" })}
            className="mt-6 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-accent"
          >
            Browse leagues
          </button>
        </div>
      </main>
    );
  }
  if (!league) return null;
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 lg:py-10">
        <header className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                NOVA / League Operations
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                {league.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {league.status && (
                  <span className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {league.status}
                  </span>
                )}
                <span className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  League Panel
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadPanel()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
            >
              <ArrowRight className="size-4 rotate-180" />
              Refresh
            </button>
          </div>
        </header>
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <aside className="h-fit rounded-xl border bg-card p-2">
            <PanelNavButton
              active={activeSection === "overview"}
              onClick={() => setActiveSection("overview")}
            >
              Overview
            </PanelNavButton>
            <PanelNavButton
              active={activeSection === "divisions"}
              onClick={() => setActiveSection("divisions")}
            >
              Divisions
            </PanelNavButton>
            <PanelNavButton
              active={activeSection === "teams"}
              onClick={() => setActiveSection("teams")}
            >
              Confirmed Teams
            </PanelNavButton>
          </aside>
          <section className="min-w-0">
            {activeSection === "overview" && (
              <div>
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Overview
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    League operations
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Manage the competition structure and confirm
                    registered NOVA teams into divisions.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard
                    label="Divisions"
                    value={divisions.length}
                    icon={<Shield className="size-5" />}
                  />
                  <StatCard
                    label="Confirmed teams"
                    value={teams.length}
                    icon={<Users className="size-5" />}
                  />
                  <StatCard
                    label="League status"
                    value={league.status ?? "Active"}
                    icon={<Check className="size-5" />}
                  />
                </div>
                <div className="mt-8 rounded-xl border bg-card p-6">
                  <div className="flex items-start gap-4">
                    <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                      <Shield className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        Confirmed team workflow
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Teams register on NOVA first. From here,
                        you select an existing NOVA team, choose its
                        division, and confirm it into this league.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveSection("teams")}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                      >
                        Manage confirmed teams
                        <ArrowRight className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeSection === "divisions" && (
              <div>
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Competition structure
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    Divisions
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    View the divisions currently connected to this
                    league and their confirmed teams.
                  </p>
                </div>
                {divisions.length === 0 ? (
                  <EmptyState
                    title="No divisions yet"
                    description="This league doesn't have any divisions configured yet."
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {divisions.map((division) => (
                      <button
                        key={division.id}
                        type="button"
                        onClick={() => {
                          setSelectedDivisionId(division.id);
                          setActiveSection("teams");
                        }}
                        className="rounded-xl border bg-card p-5 text-left transition hover:bg-accent/40"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold">
                              {division.name}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {divisionCounts[division.id] ?? 0}{" "}
                              confirmed{" "}
                              {(divisionCounts[division.id] ?? 0) === 1
                                ? "team"
                                : "teams"}
                            </p>
                          </div>
                          <ArrowRight className="size-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeSection === "teams" && (
              <div>
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Team registration
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    Confirmed Teams
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Search every team registered on NOVA, select the
                    exact team, choose a division, and confirm it.
                    A team does not need to provide a league link.
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-6">
                  <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                    <div>
                      <label className="text-sm font-semibold">
                        Search NOVA teams
                      </label>
                      <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="search"
                          value={teamSearch}
                          onChange={(event) =>
                            void searchTeams(event.target.value)
                          }
                          placeholder="Type a team name..."
                          className="w-full rounded-lg border bg-background py-3 pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                        />
                        {searchingTeams && (
                          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {teamSearch.trim() && (
                        <div className="mt-3 overflow-hidden rounded-lg border">
                          {unassignedSearchResults.length === 0 ? (
                            <div className="px-4 py-5 text-sm text-muted-foreground">
                              No matching NOVA teams found.
                            </div>
                          ) : (
                            <div className="divide-y">
                              {unassignedSearchResults.map((team) => {
                                const alreadyInThisLeague =
                                  team.league_id === league.id;
                                return (
                                  <button
                                    key={team.id}
                                    type="button"
                                    onClick={() => setSelectedTeam(team)}
                                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent ${
                                      selectedTeam?.id === team.id
                                        ? "bg-accent"
                                        : ""
                                    }`}
                                  >
                                    <TeamAvatar team={team} />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold">
                                        {team.name}
                                      </p>
                                      {team.short_name && (
                                        <p className="truncate text-xs text-muted-foreground">
                                          {team.short_name}
                                        </p>
                                      )}
                                    </div>
                                    {alreadyInThisLeague ? (
                                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        In league
                                      </span>
                                    ) : (
                                      <Plus className="size-4 text-muted-foreground" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-semibold">
                        Division
                      </label>
                      <div className="relative mt-2">
                        <select
                          value={selectedDivisionId}
                          onChange={(event) =>
                            setSelectedDivisionId(event.target.value)
                          }
                          className="w-full appearance-none rounded-lg border bg-background px-4 py-3 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                        >
                          <option value="">
                            Select division...
                          </option>
                          {divisions.map((division) => (
                            <option
                              key={division.id}
                              value={division.id}
                            >
                              {division.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                  {selectedTeam && (
                    <div className="mt-6 rounded-lg border bg-background p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <TeamAvatar team={selectedTeam} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {selectedTeam.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {selectedTeam.league_id === league.id
                                ? "Already registered in this league"
                                : "Registered on NOVA"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void confirmTeam()}
                          disabled={
                            saving ||
                            !selectedDivisionId ||
                            selectedTeam.league_id === league.id
                          }
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                          {selectedTeam.league_id === league.id
                            ? "Already confirmed"
                            : "Confirm team"}
                        </button>
                      </div>
                    </div>
                  )}
                  {message && (
                    <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0" />
                      <p>{message}</p>
                    </div>
                  )}
                  {error && league && (
                    <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}
                </div>
                <div className="mt-8">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Current membership
                      </p>
                      <h3 className="mt-1 text-xl font-bold">
                        {selectedDivision?.name ??
                          "Select a division"}
                      </h3>
                    </div>
                    {selectedDivision && (
                      <span className="text-sm text-muted-foreground">
                        {teamsInSelectedDivision.length} confirmed
                      </span>
                    )}
                  </div>
                  {!selectedDivision ? (
                    <EmptyState
                      title="Select a division"
                      description="Choose a division above to see its confirmed teams."
                    />
                  ) : teamsInSelectedDivision.length === 0 ? (
                    <EmptyState
                      title="No confirmed teams"
                      description={`No teams have been confirmed in ${selectedDivision.name} yet.`}
                    />
                  ) : (
                    <div className="overflow-hidden rounded-xl border bg-card">
                      <div className="hidden grid-cols-[1fr_220px_130px_48px] gap-4 border-b px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                        <span>Team</span>
                        <span>Manager</span>
                        <span>Status</span>
                        <span />
                      </div>
                      <div className="divide-y">
                        {teamsInSelectedDivision.map((team) => {
                          const manager = team.manager_id
                            ? profiles[team.manager_id]
                            : null;
                          return (
                            <div
                              key={team.id}
                              className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_220px_130px_48px] md:items-center"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <TeamAvatar team={team} />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">
                                    {team.name}
                                  </p>
                                  {team.short_name && (
                                    <p className="truncate text-xs text-muted-foreground">
                                      {team.short_name}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm">
                                  {manager?.display_name ??
                                    manager?.username ??
                                    "No manager"}
                                </p>
                                {manager?.username &&
                                  manager.display_name && (
                                    <p className="truncate text-xs text-muted-foreground">
                                      @{manager.username}
                                    </p>
                                  )}
                              </div>
                              <div>
                                <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">
                                  <span className="size-1.5 rounded-full bg-current" />
                                  Confirmed
                                </span>
                              </div>
                              <button
                                type="button"
                                title={`Remove ${team.name}`}
                                disabled={saving}
                                onClick={() => void removeTeam(team)}
                                className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
function PanelNavButton({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="grid size-10 place-items-center rounded-lg bg-accent">
          {icon}
        </div>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
function TeamAvatar({ team }: { team: Team }) {
  if (team.logo_url) {
    return (
      <img
        src={team.logo_url}
        alt=""
        className="size-10 shrink-0 rounded-lg border bg-background object-contain p-1"
      />
    );
  }
  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-lg border bg-background text-xs font-bold text-muted-foreground">
      {team.name.slice(0, 2).toUpperCase()}
    </div>
  );
}
function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-6 py-12 text-center">
      <Users className="mx-auto size-8 text-muted-foreground" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
