import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Loader2,
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
  league_id: string;
  name: string;
  slug: string | null;
};
type Team = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  league_id: string | null;
  division_id: string | null;
  manager_id: string | null;
};
type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
};
type LeagueMember = {
  league_id: string;
  role: "overseer" | "co_overseer";
};
export const Route = createFileRoute("/league")({
  ssr: false,
  component: LeaguePanel,
});
function LeaguePanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [memberRole, setMemberRole] = useState<
    "overseer" | "co_overseer" | null
  >(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [confirmedTeams, setConfirmedTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [teamSearch, setTeamSearch] = useState("");
  const [teamResults, setTeamResults] = useState<Team[]>([]);
  const [searchingTeams, setSearchingTeams] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "overview" | "divisions" | "teams"
  >("overview");
  useEffect(() => {
    void loadPanel();
  }, []);
  async function loadPanel() {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      void navigate({ to: "/auth" });
      return;
    }
    /*
     * IMPORTANT:
     * League access is determined from league_members.
     * Do not rely on app_metadata, user_metadata, or ownership of a team.
     */
    const { data: memberships, error: membershipError } = await supabase
      .from("league_members")
      .select("league_id,role")
      .eq("user_id", user.id)
      .in("role", ["overseer", "co_overseer"]);
    if (membershipError) {
      console.error("Failed to load league memberships:", membershipError);
      setError("Couldn't check your league permissions.");
      setLoading(false);
      return;
    }
    const memberRows = (memberships ?? []) as LeagueMember[];
    if (memberRows.length === 0) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    const membership = memberRows[0];
    const { data: leagueData, error: leagueError } = await supabase
      .from("leagues")
      .select("id,name,slug,status")
      .eq("id", membership.league_id)
      .maybeSingle();
    if (leagueError || !leagueData) {
      console.error("Failed to load league:", leagueError);
      setError("Couldn't load your league.");
      setLoading(false);
      return;
    }
    setLeague(leagueData as League);
    setMemberRole(membership.role);
    const [{ data: divisionData, error: divisionError }, { data: teamData, error: teamError }] =
      await Promise.all([
        supabase
          .from("divisions")
          .select("id,league_id,name,slug")
          .eq("league_id", membership.league_id)
          .order("name", { ascending: true }),
        supabase
          .from("teams")
          .select(
            "id,name,short_name,logo_url,league_id,division_id,manager_id",
          )
          .eq("league_id", membership.league_id)
          .order("name", { ascending: true }),
      ]);
    if (divisionError) {
      console.error("Failed to load divisions:", divisionError);
      setError("Couldn't load league divisions.");
      setLoading(false);
      return;
    }
    if (teamError) {
      console.error("Failed to load teams:", teamError);
      setError("Couldn't load league teams.");
      setLoading(false);
      return;
    }
    const divisionsList = (divisionData ?? []) as Division[];
    const teamsList = (teamData ?? []) as Team[];
    setDivisions(divisionsList);
    setConfirmedTeams(teamsList);
    const managerIds = teamsList
      .map((team) => team.manager_id)
      .filter((id): id is string => Boolean(id));
    if (managerIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,display_name,username")
        .in("id", managerIds);
      const profileMap: Record<string, Profile> = {};
      for (const profile of (profileData ?? []) as Profile[]) {
        profileMap[profile.id] = profile;
      }
      setProfiles(profileMap);
    } else {
      setProfiles({});
    }
    setLoading(false);
  }
  async function searchTeams(value: string) {
    setTeamSearch(value);
    const query = value.trim();
    if (!query) {
      setTeamResults([]);
      return;
    }
    setSearchingTeams(true);
    const { data, error: searchError } = await supabase
      .from("teams")
      .select(
        "id,name,short_name,logo_url,league_id,division_id,manager_id",
      )
      .or(`name.ilike.%${query}%,short_name.ilike.%${query}%`)
      .order("name", { ascending: true })
      .limit(20);
    if (searchError) {
      console.error("Failed to search teams:", searchError);
      setTeamResults([]);
      setSearchingTeams(false);
      return;
    }
    setTeamResults((data ?? []) as Team[]);
    setSearchingTeams(false);
  }
  async function confirmTeam() {
    if (!selectedTeam || !selectedDivisionId || !league) return;
    setSavingTeam(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("teams")
      .update({
        league_id: league.id,
        division_id: selectedDivisionId,
      })
      .eq("id", selectedTeam.id)
      .select(
        "id,name,short_name,logo_url,league_id,division_id,manager_id",
      )
      .single();
    if (updateError) {
      console.error("Failed to confirm team:", updateError);
      setError(updateError.message);
      setSavingTeam(false);
      return;
    }
    const updatedTeam = data as Team;
    setConfirmedTeams((current) => {
      const existing = current.findIndex(
        (team) => team.id === updatedTeam.id,
      );
      if (existing === -1) {
        return [...current, updatedTeam].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      }
      const copy = [...current];
      copy[existing] = updatedTeam;
      return copy;
    });
    setSelectedTeam(null);
    setSelectedDivisionId("");
    setTeamSearch("");
    setTeamResults([]);
    setSavingTeam(false);
  }
  async function removeTeam(team: Team) {
    if (!league) return;
    const confirmed = window.confirm(
      `Remove ${team.name} from ${league.name}?`,
    );
    if (!confirmed) return;
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
      setError(updateError.message);
      return;
    }
    setConfirmedTeams((current) =>
      current.filter((item) => item.id !== team.id),
    );
  }
  const teamsByDivision = useMemo(() => {
    const grouped: Record<string, Team[]> = {};
    for (const division of divisions) {
      grouped[division.id] = [];
    }
    for (const team of confirmedTeams) {
      if (team.division_id && grouped[team.division_id]) {
        grouped[team.division_id].push(team);
      }
    }
    return grouped;
  }, [divisions, confirmedTeams]);
  function getManagerName(team: Team) {
    if (!team.manager_id) return "No manager";
    const profile = profiles[team.manager_id];
    if (!profile) return "Manager";
    return (
      profile.display_name ||
      profile.username ||
      "Manager"
    );
  }
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (accessDenied) {
    return (
      <main className="min-h-screen bg-background px-5 py-10">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl border bg-card">
            <Shield className="size-6 text-muted-foreground" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">
            League access required
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Your account is not currently assigned as an overseer or
            co-overseer of a league.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Return home
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>
    );
  }
  if (!league) {
    return null;
  }
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              NOVA / League Panel
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              {league.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                {memberRole === "overseer" ? "Overseer" : "Co-Overseer"}
              </span>
              {league.status && (
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {league.status}
                </span>
              )}
            </div>
          </div>
          <Link
            to="/leagues"
            className="inline-flex items-center gap-2 self-start rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-accent lg:self-auto"
          >
            View leagues
            <ArrowRight className="size-4" />
          </Link>
        </div>
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p>{error}</p>
          </div>
        )}
        <div className="mt-8 grid gap-3 border-b pb-3 sm:flex sm:flex-wrap">
          <button
            onClick={() => setActiveSection("overview")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeSection === "overview"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveSection("divisions")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeSection === "divisions"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            Divisions
          </button>
          <button
            onClick={() => setActiveSection("teams")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeSection === "teams"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            Confirmed Teams
          </button>
        </div>
        {activeSection === "overview" && (
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Divisions
              </p>
              <p className="mt-3 text-3xl font-bold">
                {divisions.length}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Confirmed teams
              </p>
              <p className="mt-3 text-3xl font-bold">
                {confirmedTeams.length}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your role
              </p>
              <p className="mt-3 text-xl font-bold capitalize">
                {memberRole?.replace("_", "-")}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6 md:col-span-3">
              <div className="flex items-start gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Users className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold">
                    League operations
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Confirm teams into divisions from the central NOVA team
                    database. Teams do not automatically enter a league when
                    they are created.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
        {activeSection === "divisions" && (
          <section className="mt-8 space-y-4">
            {divisions.length === 0 ? (
              <div className="rounded-xl border bg-card px-6 py-12 text-center">
                <h2 className="font-semibold">
                  No divisions yet
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  This league does not have any divisions configured yet.
                </p>
              </div>
            ) : (
              divisions.map((division) => {
                const teams = teamsByDivision[division.id] ?? [];
                return (
                  <div
                    key={division.id}
                    className="rounded-xl border bg-card"
                  >
                    <div className="flex flex-col gap-2 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="font-semibold">
                          {division.name}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {teams.length} confirmed{" "}
                          {teams.length === 1 ? "team" : "teams"}
                        </p>
                      </div>
                    </div>
                    {teams.length === 0 ? (
                      <div className="px-5 py-8 text-sm text-muted-foreground">
                        No teams confirmed in this division.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {teams.map((team) => (
                          <div
                            key={team.id}
                            className="flex items-center gap-4 p-5"
                          >
                            {team.logo_url ? (
                              <img
                                src={team.logo_url}
                                alt=""
                                className="size-10 rounded-lg object-contain"
                              />
                            ) : (
                              <div className="grid size-10 place-items-center rounded-lg border text-xs font-bold">
                                {team.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">
                                {team.name}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {getManagerName(team)}
                              </p>
                            </div>
                            <button
                              onClick={() => void removeTeam(team)}
                              className="rounded-lg border p-2 text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
                              title="Remove team"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        )}
        {activeSection === "teams" && (
          <section className="mt-8 space-y-8">
            <div className="rounded-xl border bg-card p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Add team
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Confirm a NOVA team
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Search every team registered on NOVA. A team link is not
                  required. Select the exact team, choose its division, then
                  confirm it.
                </p>
              </div>
              <div className="relative mt-6">
                <div className="flex items-center gap-3 rounded-lg border bg-background px-3">
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    value={teamSearch}
                    onChange={(event) => {
                      void searchTeams(event.target.value);
                      setSelectedTeam(null);
                    }}
                    placeholder="Search team name..."
                    className="w-full bg-transparent py-3 text-sm outline-none"
                  />
                  {searchingTeams && (
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                </div>
                {teamSearch.trim() && (
                  <div className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border bg-card shadow-xl">
                    {teamResults.length === 0 && !searchingTeams ? (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No NOVA teams found.
                      </div>
                    ) : (
                      teamResults.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => {
                            setSelectedTeam(team);
                            setTeamSearch(team.name);
                            setTeamResults([]);
                          }}
                          className="flex w-full items-center gap-3 border-b p-4 text-left last:border-b-0 hover:bg-accent"
                        >
                          {team.logo_url ? (
                            <img
                              src={team.logo_url}
                              alt=""
                              className="size-9 rounded-lg object-contain"
                            />
                          ) : (
                            <div className="grid size-9 place-items-center rounded-lg border text-[10px] font-bold">
                              {team.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {team.name}
                            </p>
                            {team.short_name && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {team.short_name}
                              </p>
                            )}
                          </div>
                          <ArrowRight className="size-4 text-muted-foreground" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedTeam && (
                <div className="mt-5 rounded-xl border bg-background p-4">
                  <div className="flex items-center gap-3">
                    {selectedTeam.logo_url ? (
                      <img
                        src={selectedTeam.logo_url}
                        alt=""
                        className="size-11 rounded-lg object-contain"
                      />
                    ) : (
                      <div className="grid size-11 place-items-center rounded-lg border text-xs font-bold">
                        {selectedTeam.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {selectedTeam.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedTeam.league_id
                          ? "Currently assigned to a league"
                          : "Not currently assigned to a league"}
                      </p>
                    </div>
                    <Check className="size-5 text-primary" />
                  </div>
                  <div className="mt-5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Division
                    </label>
                    <div className="relative mt-2">
                      <select
                        value={selectedDivisionId}
                        onChange={(event) =>
                          setSelectedDivisionId(event.target.value)
                        }
                        className="w-full appearance-none rounded-lg border bg-background px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">
                          Select a division...
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
                  <button
                    onClick={() => void confirmTeam()}
                    disabled={!selectedDivisionId || savingTeam}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingTeam ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      <>
                        <Check className="size-4" />
                        Confirm team
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            <div>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Current league teams
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Confirmed Teams
                </h2>
              </div>
              {confirmedTeams.length === 0 ? (
                <div className="rounded-xl border bg-card px-6 py-12 text-center">
                  <Users className="mx-auto size-8 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold">
                    No teams confirmed
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Search for a registered NOVA team above to add one.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border bg-card">
                  <div className="hidden grid-cols-[1fr_1fr_180px_44px] gap-4 border-b px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                    <span>Team</span>
                    <span>Manager</span>
                    <span>Division</span>
                    <span />
                  </div>
                  <div className="divide-y">
                    {confirmedTeams.map((team) => {
                      const division = divisions.find(
                        (item) => item.id === team.division_id,
                      );
                      return (
                        <div
                          key={team.id}
                          className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_180px_44px] md:items-center md:gap-4"
                        >
                          <div className="flex items-center gap-3">
                            {team.logo_url ? (
                              <img
                                src={team.logo_url}
                                alt=""
                                className="size-9 rounded-lg object-contain"
                              />
                            ) : (
                              <div className="grid size-9 place-items-center rounded-lg border text-[10px] font-bold">
                                {team.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {team.name}
                              </p>
                              {team.short_name && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {team.short_name}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-sm">
                            <span className="text-xs text-muted-foreground md:hidden">
                              Manager:{" "}
                            </span>
                            {getManagerName(team)}
                          </div>
                          <div className="text-sm">
                            <span className="text-xs text-muted-foreground md:hidden">
                              Division:{" "}
                            </span>
                            {division?.name ?? "Unassigned"}
                          </div>
                          <button
                            onClick={() => void removeTeam(team)}
                            className="inline-flex size-9 items-center justify-center rounded-lg border text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
                            title="Remove from league"
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
          </section>
        )}
      </div>
    </main>
  );
}
