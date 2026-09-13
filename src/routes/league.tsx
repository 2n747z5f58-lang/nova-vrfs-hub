import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  Loader2,
  RefreshCw,
  Shield,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type League = {
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
  logo_url: string | null;
  description: string | null;
  season: string | null;
};

type Division = {
  id: string;
  league_id: string;
  name: string;
  tier: number | null;
  season: string | null;
  status: string | null;
  start_date: string | null;
  ended_at: string | null;
  gameweek_interval_days: number | null;
  points_tier:
    | "unranked"
    | "elite"
    | "tier_2"
    | "tier_3"
    | null;
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
  username: string | null;
  display_name: string | null;
  discord_id: string | null;
};

type LeagueMember = {
  id: string;
  league_id: string;
  user_id: string;
  role: "overseer" | "co_overseer";
};

type TeamStaff = {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
};

type Fixture = {
  id: string;
  league_id: string | null;
  division_id: string | null;
  gameweek: number | null;
  kickoff_at: string;
  deadline_at: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  completion_source: string | null;
  completion_note: string | null;
  completed_at: string | null;
};

type Result = {
  fixture_id: string;
  home_score: number;
  away_score: number;
  notes: string | null;
  recorded_at: string;
  submitted_by: string | null;
  replay_code: string | null;
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

type PointAdjustment = {
  id: string;
  division_id: string;
  team_id: string;
  points_delta: number;
  reason: string;
  applied_by: string | null;
  created_at: string;
};

type Section =
  | "overview"
  | "fixtures"
  | "results"
  | "table"
  | "teams"
  | "divisions"
  | "deductions"
  | "overseers";

const OWNER_IDENTIFIER = "aa23fr";

const TIER_OPTIONS = [
  { value: "unranked", label: "Unranked" },
  { value: "elite", label: "Elite" },
  { value: "tier_2", label: "Tier 2" },
  { value: "tier_3", label: "Tier 3" },
] as const;

export const Route = createFileRoute("/league")({
  ssr: false,
  component: LeaguePanel,
});

function LeaguePanel() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [league, setLeague] = useState<League | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [teamStaff, setTeamStaff] = useState<TeamStaff[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [adjustments, setAdjustments] = useState<PointAdjustment[]>([]);

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [memberRole, setMemberRole] = useState<
    "overseer" | "co_overseer" | null
  >(null);

  const [activeSection, setActiveSection] =
    useState<Section>("overview");

  const [selectedDivisionId, setSelectedDivisionId] =
    useState("all");

  const [selectedFixtureId, setSelectedFixtureId] =
    useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newDivisionName, setNewDivisionName] = useState("");
  const [newDivisionTier, setNewDivisionTier] = useState("1");

  const [deductionDivisionId, setDeductionDivisionId] =
    useState("");
  const [deductionTeamId, setDeductionTeamId] =
    useState("");
  const [deductionAmount, setDeductionAmount] =
    useState("");
  const [deductionReason, setDeductionReason] =
    useState("");

  const [newOverseerUsername, setNewOverseerUsername] =
    useState("");

  const canManageLeague =
    isOwner ||
    isAdmin ||
    memberRole === "overseer" ||
    memberRole === "co_overseer";

  const teamMap = useMemo(() => {
    const map: Record<string, Team> = {};

    for (const team of teams) {
      map[team.id] = team;
    }

    return map;
  }, [teams]);

  const divisionMap = useMemo(() => {
    const map: Record<string, Division> = {};

    for (const division of divisions) {
      map[division.id] = division;
    }

    return map;
  }, [divisions]);

  const profileMap = profiles;

  const visibleFixtures = useMemo(() => {
    if (selectedDivisionId === "all") {
      return fixtures;
    }

    return fixtures.filter(
      (fixture) =>
        fixture.division_id === selectedDivisionId,
    );
  }, [fixtures, selectedDivisionId]);

  const visibleStandings = useMemo(() => {
    if (selectedDivisionId === "all") {
      return standings;
    }

    return standings.filter(
      (standing) =>
        standing.division_id === selectedDivisionId,
    );
  }, [standings, selectedDivisionId]);

  const visibleAdjustments = useMemo(() => {
    if (selectedDivisionId === "all") {
      return adjustments;
    }

    return adjustments.filter(
      (adjustment) =>
        adjustment.division_id === selectedDivisionId,
    );
  }, [adjustments, selectedDivisionId]);

  const completedFixtures = useMemo(
    () =>
      visibleFixtures.filter(
        (fixture) =>
          fixture.status === "completed",
      ),
    [visibleFixtures],
  );

  const scheduledFixtures = useMemo(
    () =>
      visibleFixtures.filter(
        (fixture) =>
          fixture.status !== "completed",
      ),
    [visibleFixtures],
  );

  useEffect(() => {
    void loadPanel();
  }, []);

  async function loadPanel(showSpinner = true) {
    try {
      if (showSpinner) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        void navigate({ to: "/auth" });
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "id,username,display_name,discord_id",
        )
        .eq("id", user.id)
        .maybeSingle();

      const owner =
        user.id === OWNER_IDENTIFIER ||
        profile?.username === OWNER_IDENTIFIER ||
        profile?.discord_id === OWNER_IDENTIFIER;

      setIsOwner(owner);

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const admin = (roleRows ?? []).some(
        (row) =>
          String(row.role).toLowerCase() === "admin",
      );

      setIsAdmin(admin);

      const {
        data: membershipRows,
        error: membershipError,
      } = await supabase
        .from("league_members")
        .select(
          "id,league_id,user_id,role",
        )
        .eq("user_id", user.id)
        .in("role", [
          "overseer",
          "co_overseer",
        ]);

      if (membershipError) {
        throw new Error(
          membershipError.message,
        );
      }

      const memberships =
        (membershipRows ?? []) as LeagueMember[];

      if (
        memberships.length === 0 &&
        !admin &&
        !owner
      ) {
        setError(
          "You don't have access to the League Panel.",
        );
        return;
      }

      let membership =
        memberships[0] ?? null;

      if (!membership && (admin || owner)) {
        const {
          data: fallbackMembership,
        } = await supabase
          .from("league_members")
          .select(
            "id,league_id,user_id,role",
          )
          .order("created_at", {
            ascending: true,
          })
          .limit(1)
          .maybeSingle();

        membership =
          (fallbackMembership as LeagueMember | null) ??
          null;
      }

      if (!membership) {
        throw new Error(
          "No league is available for this account.",
        );
      }

      setMemberRole(membership.role);

      const leagueId = membership.league_id;

      const [
        leagueResponse,
        divisionsResponse,
        teamsResponse,
        membersResponse,
        staffResponse,
        fixturesResponse,
        standingsResponse,
        resultsResponse,
        adjustmentResponse,
      ] = await Promise.all([
        supabase
          .from("leagues")
          .select(
            "id,name,slug,status,logo_url,description,season",
          )
          .eq("id", leagueId)
          .maybeSingle(),

        supabase
          .from("divisions")
          .select(
            "id,league_id,name,tier,season,status,start_date,ended_at,gameweek_interval_days,points_tier",
          )
          .eq("league_id", leagueId)
          .order("tier", {
            ascending: true,
          })
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("teams")
          .select(
            "id,name,short_name,logo_url,league_id,division_id,manager_id",
          )
          .eq("league_id", leagueId)
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("league_members")
          .select(
            "id,league_id,user_id,role",
          )
          .eq("league_id", leagueId)
          .order("role", {
            ascending: true,
          }),

        supabase
          .from("team_staff")
          .select(
            "id,team_id,user_id,role",
          ),

        supabase
          .from("fixtures")
          .select(
            "id,league_id,division_id,gameweek,kickoff_at,deadline_at,status,home_score,away_score,home_team_id,away_team_id,completion_source,completion_note,completed_at",
          )
          .eq("league_id", leagueId)
          .order("kickoff_at", {
            ascending: true,
          }),

        supabase
          .from("standings")
          .select(
            "id,division_id,team_id,played,won,drawn,lost,goals_for,goals_against,goal_difference,points",
          )
          .order("points", {
            ascending: false,
          }),

        supabase
          .from("results")
          .select(
            "fixture_id,home_score,away_score,notes,recorded_at,submitted_by,replay_code",
          )
          .order("recorded_at", {
            ascending: false,
          }),

        supabase
          .from("standings_point_adjustments")
          .select(
            "id,division_id,team_id,points_delta,reason,applied_by,created_at",
          )
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (leagueResponse.error) {
        throw new Error(
          leagueResponse.error.message,
        );
      }

      if (divisionsResponse.error) {
        throw new Error(
          divisionsResponse.error.message,
        );
      }

      if (teamsResponse.error) {
        throw new Error(
          teamsResponse.error.message,
        );
      }

      if (membersResponse.error) {
        throw new Error(
          membersResponse.error.message,
        );
      }

      if (staffResponse.error) {
        throw new Error(
          staffResponse.error.message,
        );
      }

      if (fixturesResponse.error) {
        throw new Error(
          fixturesResponse.error.message,
        );
      }

      if (standingsResponse.error) {
        throw new Error(
          standingsResponse.error.message,
        );
      }

      if (resultsResponse.error) {
        throw new Error(
          resultsResponse.error.message,
        );
      }

      if (adjustmentResponse.error) {
        throw new Error(
          adjustmentResponse.error.message,
        );
      }

      const loadedLeague =
        leagueResponse.data as League | null;

      if (!loadedLeague) {
        throw new Error(
          "The league could not be found.",
        );
      }

      const loadedDivisions =
        (divisionsResponse.data ?? []) as Division[];

      const loadedTeams =
        (teamsResponse.data ?? []) as Team[];

      const loadedMembers =
        (membersResponse.data ?? []) as LeagueMember[];

      const loadedStaff =
        (staffResponse.data ?? []) as TeamStaff[];

      const loadedFixtures =
        (fixturesResponse.data ?? []) as Fixture[];

      const loadedStandings =
        (standingsResponse.data ?? []) as Standing[];

      const loadedResults =
        (resultsResponse.data ?? []) as Result[];

      const loadedAdjustments =
        (adjustmentResponse.data ?? []) as PointAdjustment[];

      setLeague(loadedLeague);
      setDivisions(loadedDivisions);
      setTeams(loadedTeams);
      setMembers(loadedMembers);
      setTeamStaff(loadedStaff);
      setFixtures(loadedFixtures);
      setStandings(loadedStandings);
      setResults(loadedResults);
      setAdjustments(loadedAdjustments);

      const profileIds = [
        ...new Set(
          [
            ...loadedMembers.map(
              (member) => member.user_id,
            ),
            ...loadedTeams
              .map(
                (team) =>
                  team.manager_id,
              )
              .filter(Boolean),
            ...loadedStaff
              .map(
                (staff) =>
                  staff.user_id,
              )
              .filter(Boolean),
            ...loadedAdjustments
              .map(
                (adjustment) =>
                  adjustment.applied_by,
              )
              .filter(Boolean),
          ].filter(
            (id): id is string =>
              Boolean(id),
          ),
        ),
      ];

      if (profileIds.length > 0) {
        const {
          data: profileRows,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "id,username,display_name,discord_id",
          )
          .in("id", profileIds);

        if (profileError) {
          throw new Error(
            profileError.message,
          );
        }

        const nextProfiles: Record<
          string,
          Profile
        > = {};

        for (const row of (profileRows ??
          []) as Profile[]) {
          nextProfiles[row.id] = row;
        }

        setProfiles(nextProfiles);
      } else {
        setProfiles({});
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Couldn't load the League Panel.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function saveFixtureDeadline(
    fixtureId: string,
    deadline: string,
  ) {
    if (!canManageLeague) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const deadlineValue = deadline
        ? new Date(deadline).toISOString()
        : null;

      const { error: updateError } =
        await supabase
          .from("fixtures")
          .update({
            deadline_at: deadlineValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", fixtureId);

      if (updateError) {
        throw new Error(
          updateError.message,
        );
      }

      setSuccess(
        "Fixture deadline updated.",
      );

      await loadPanel(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't update the fixture deadline.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function overrideFixture(
    fixture: Fixture,
  ) {
    if (!canManageLeague) {
      return;
    }

    if (
      fixture.status === "completed"
    ) {
      setError(
        "This fixture is already completed.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Complete ${teamName(fixture.home_team_id)} vs ${teamName(fixture.away_team_id)} as 0-0?`,
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const now =
        new Date().toISOString();

      const {
        error: fixtureError,
      } = await supabase
        .from("fixtures")
        .update({
          home_score: 0,
          away_score: 0,
          status: "completed",
          completion_source: "admin_override",
          completion_note:
            "Completed as 0-0 by an authorised League Panel user.",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", fixture.id);

      if (fixtureError) {
        throw new Error(
          fixtureError.message,
        );
      }

      const { error: resultError } =
        await supabase
          .from("results")
          .upsert(
            {
              fixture_id: fixture.id,
              home_score: 0,
              away_score: 0,
              notes:
                "Authorised League Panel 0-0 override.",
              submitted_by: userId,
              completed_at: now,
            },
            {
              onConflict: "fixture_id",
            },
          );

      if (resultError) {
        throw new Error(
          resultError.message,
        );
      }

      setSuccess(
        "Fixture completed as an authorised 0-0.",
      );

      setSelectedFixtureId(null);

      await loadPanel(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't override the fixture.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createDivision() {
    if (!league || !canManageLeague) {
      return;
    }

    const name =
      newDivisionName.trim();

    if (!name) {
      setError(
        "Enter a division name.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: insertError } =
        await supabase
          .from("divisions")
          .insert({
            league_id: league.id,
            name,
            tier:
              Number(newDivisionTier) || 1,
            season: league.season,
            status: "draft",
            gameweek_interval_days: 3,
          });

      if (insertError) {
        throw new Error(
          insertError.message,
        );
      }

      setNewDivisionName("");
      setNewDivisionTier("1");

      setSuccess(
        "Division created.",
      );

      await loadPanel(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't create the division.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateDivisionTier(
    divisionId: string,
    pointsTier: Division["points_tier"],
  ) {
    if (!isOwner) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } =
        await supabase
          .from("divisions")
          .update({
            points_tier: pointsTier,
          })
          .eq("id", divisionId);

      if (updateError) {
        throw new Error(
          updateError.message,
        );
      }

      setSuccess(
        "Scoring tier updated.",
      );

      await loadPanel(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't update the scoring tier.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeDivisionStatus(
    divisionId: string,
    status: string,
  ) {
    if (!canManageLeague) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const update: Record<
        string,
        string | null
      > = {
        status,
      };

      if (status === "active") {
        update.start_date =
          new Date().toISOString();
        update.ended_at = null;
      }

      if (status === "ended") {
        update.ended_at =
          new Date().toISOString();
      }

      const { error: updateError } =
        await supabase
          .from("divisions")
          .update(update)
          .eq("id", divisionId);

      if (updateError) {
        throw new Error(
          updateError.message,
        );
      }

      setSuccess(
        status === "active"
          ? "Division started."
          : status === "ended"
            ? "Division ended."
            : "Division returned to draft.",
      );

      await loadPanel(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't update the division.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyDeduction() {
    if (!userId || !canManageLeague) {
      return;
    }

    if (
      !deductionDivisionId ||
      !deductionTeamId
    ) {
      setError(
        "Select a division and team.",
      );
      return;
    }

    const amount =
      Number(deductionAmount);

    if (
      !Number.isInteger(amount) ||
      amount === 0
    ) {
      setError(
        "Enter a whole-number points adjustment.",
      );
      return;
    }

    const reason =
      deductionReason.trim();

    if (!reason) {
      setError(
        "Enter a reason for the adjustment.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: rpcError } =
        await supabase.rpc(
          "apply_standings_point_adjustment",
          {
            p_division_id:
              deductionDivisionId,
            p_team_id:
              deductionTeamId,
            p_points_delta:
              amount,
            p_reason: reason,
          },
        );

      if (rpcError) {
        throw new Error(
          rpcError.message,
        );
      }

      setDeductionAmount("");
      setDeductionReason("");

      setSuccess(
        amount < 0
          ? `${Math.abs(amount)} points deducted.`
          : `${amount} points restored.`,
      );

      await loadPanel(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't apply the points adjustment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addCoOverseer() {
    if (
      !league ||
      !canManageLeague
    ) {
      return;
    }

    const query =
      newOverseerUsername.trim();

    if (!query) {
      setError(
        "Enter a NOVA username or Discord ID.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: profile } =
        await supabase
          .from("profiles")
          .select(
            "id,username,display_name,discord_id",
          )
          .or(
            `username.eq.${query},discord_id.eq.${query}`,
          )
          .maybeSingle();

      if (!profile) {
        throw new Error(
          "That NOVA profile could not be found.",
        );
      }

      const { error: insertError } =
        await supabase
          .from("league_members")
          .upsert(
            {
              league_id: league.id,
              user_id: profile.id,
              role: "co_overseer",
            },
            {
              onConflict:
                "league_id,user_id",
            },
          );

      if (insertError) {
        throw new Error(
          insertError.message,
        );
      }

      setNewOverseerUsername("");

      setSuccess(
        "Co-Overseer added.",
      );

      await loadPanel(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't add the Co-Overseer.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(
    memberId: string,
  ) {
    if (!canManageLeague) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: deleteError } =
        await supabase
          .from("league_members")
          .delete()
          .eq("id", memberId);

      if (deleteError) {
        throw new Error(
          deleteError.message,
        );
      }

      setSuccess(
        "League staff member removed.",
      );

      await loadPanel(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't remove the staff member.",
      );
    } finally {
      setSaving(false);
    }
  }

  function teamName(
    teamId: string | null,
  ) {
    if (!teamId) {
      return "Unknown team";
    }

    return (
      teamMap[teamId]?.name ??
      "Unknown team"
    );
  }

  function divisionName(
    divisionId: string | null,
  ) {
    if (!divisionId) {
      return "Unknown division";
    }

    return (
      divisionMap[divisionId]?.name ??
      "Unknown division"
    );
  }

  function formatDate(
    value: string | null,
  ) {
    if (!value) {
      return "Not set";
    }

    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(new Date(value));
  }

  function toDateTimeLocal(
    value: string | null,
  ) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    const pad = (number: number) =>
      String(number).padStart(2, "0");

    return `${date.getFullYear()}-${pad(
      date.getMonth() + 1,
    )}-${pad(
      date.getDate(),
    )}T${pad(
      date.getHours(),
    )}:${pad(
      date.getMinutes(),
    )}`;
  }

  function getResult(
    fixtureId: string,
  ) {
    return results.find(
      (result) =>
        result.fixture_id === fixtureId,
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="size-7 animate-spin text-white/60" />
      </div>
    );
  }

  if (error && !league) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-7">
          <CircleAlert className="size-7 text-red-400" />

          <h1 className="mt-5 text-2xl font-bold">
            League Panel unavailable
          </h1>

          <p className="mt-2 text-sm text-white/50">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!league) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6 md:px-8">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-6">
            <div className="mb-7">
              <div className="text-xs font-semibold tracking-[0.2em] text-white/35">
                NOVA
              </div>

              <div className="mt-2 text-xl font-bold">
                League Panel
              </div>

              <div className="mt-1 text-sm text-white/45">
                {league.name}
              </div>
            </div>

            <nav className="space-y-1">
              {(
                [
                  ["overview", "Overview"],
                  ["fixtures", "Fixtures"],
                  ["results", "Results"],
                  ["table", "Table"],
                  ["teams", "Teams"],
                  ["divisions", "Divisions"],
                  [
                    "deductions",
                    "Point Deductions",
                  ],
                  ["overseers", "Overseers"],
                ] as const
              ).map(
                ([section, label]) => (
                  <NavButton
                    key={section}
                    active={
                      activeSection ===
                      section
                    }
                    onClick={() =>
                      setActiveSection(
                        section,
                      )
                    }
                  >
                    {label}
                  </NavButton>
                ),
              )}
            </nav>

            <div className="mt-7 border-t border-white/10 pt-5">
              <div className="text-[11px] uppercase tracking-wider text-white/30">
                Access
              </div>

              <div className="mt-2 flex items-center gap-2 text-sm text-white/60">
                <Shield className="size-4" />

                {isOwner
                  ? "NOVA Owner"
                  : isAdmin
                    ? "NOVA Admin"
                    : memberRole ===
                        "co_overseer"
                      ? "Co-Overseer"
                      : "Overseer"}
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              {league.logo_url ? (
                <img
                  src={league.logo_url}
                  alt=""
                  className="size-11 rounded-xl bg-white/5 object-contain"
                />
              ) : (
                <div className="flex size-11 items-center justify-center rounded-xl bg-white/10">
                  <Trophy className="size-5" />
                </div>
              )}

              <div>
                <h1 className="text-2xl font-bold">
                  {league.name}
                </h1>

                <p className="text-sm text-white/40">
                  {league.season ??
                    "Current season"}{" "}
                  ·{" "}
                  {league.status ??
                    "active"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={
                  selectedDivisionId
                }
                onChange={(event) =>
                  setSelectedDivisionId(
                    event.target.value,
                  )
                }
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none"
              >
                <option
                  value="all"
                  className="bg-black"
                >
                  All divisions
                </option>

                {divisions.map(
                  (division) => (
                    <option
                      key={division.id}
                      value={division.id}
                      className="bg-black"
                    >
                      {division.name}
                    </option>
                  ),
                )}
              </select>

              <button
                onClick={() =>
                  void loadPanel(false)
                }
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                <RefreshCw
                  className={
                    refreshing
                      ? "size-4 animate-spin"
                      : "size-4"
                  }
                />
                Refresh
              </button>
            </div>
          </header>

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />

              <span>{error}</span>

              <button
                className="ml-auto text-red-200/60 hover:text-red-200"
                onClick={() =>
                  setError(null)
                }
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <Check className="size-4" />
              {success}
            </div>
          )}

          {activeSection ===
            "overview" && (
            <Overview
              league={league}
              divisions={divisions}
              teams={teams}
              fixtures={fixtures}
              standings={standings}
              completedFixtures={
                completedFixtures
              }
              scheduledFixtures={
                scheduledFixtures
              }
              divisionMap={divisionMap}
              teamMap={teamMap}
            />
          )}

          {activeSection ===
            "fixtures" && (
            <FixturesSection
              fixtures={
                visibleFixtures
              }
              teamName={teamName}
              divisionName={
                divisionName
              }
              formatDate={formatDate}
              selectedFixtureId={
                selectedFixtureId
              }
              setSelectedFixtureId={
                setSelectedFixtureId
              }
              getResult={getResult}
              canManageLeague={
                canManageLeague
              }
              saving={saving}
              saveFixtureDeadline={
                saveFixtureDeadline
              }
              overrideFixture={
                overrideFixture
              }
              toDateTimeLocal={
                toDateTimeLocal
              }
            />
          )}

          {activeSection ===
            "results" && (
            <ResultsSection
              fixtures={
                completedFixtures
              }
              results={results}
              teamName={teamName}
              divisionName={
                divisionName
              }
              formatDate={formatDate}
            />
          )}

          {activeSection ===
            "table" && (
            <TableSection
              standings={
                visibleStandings
              }
              teams={teams}
              divisions={divisions}
              adjustments={
                visibleAdjustments
              }
            />
          )}

          {activeSection ===
            "teams" && (
            <TeamsSection
              teams={teams}
              divisions={divisions}
              profiles={profileMap}
              teamStaff={teamStaff}
            />
          )}

          {activeSection ===
            "divisions" && (
            <DivisionsSection
              divisions={divisions}
              teams={teams}
              isOwner={isOwner}
              canManageLeague={
                canManageLeague
              }
              newDivisionName={
                newDivisionName
              }
              setNewDivisionName={
                setNewDivisionName
              }
              newDivisionTier={
                newDivisionTier
              }
              setNewDivisionTier={
                setNewDivisionTier
              }
              createDivision={
                createDivision
              }
              updateDivisionTier={
                updateDivisionTier
              }
              changeDivisionStatus={
                changeDivisionStatus
              }
              saving={saving}
            />
          )}

          {activeSection ===
            "deductions" && (
            <DeductionsSection
              divisions={divisions}
              teams={teams}
              adjustments={
                adjustments
              }
              profiles={profiles}
              deductionDivisionId={
                deductionDivisionId
              }
              setDeductionDivisionId={
                setDeductionDivisionId
              }
              deductionTeamId={
                deductionTeamId
              }
              setDeductionTeamId={
                setDeductionTeamId
              }
              deductionAmount={
                deductionAmount
              }
              setDeductionAmount={
                setDeductionAmount
              }
              deductionReason={
                deductionReason
              }
              setDeductionReason={
                setDeductionReason
              }
              applyDeduction={
                applyDeduction
              }
              canManageLeague={
                canManageLeague
              }
              saving={saving}
            />
          )}

          {activeSection ===
            "overseers" && (
            <OverseersSection
              members={members}
              profiles={profiles}
              newOverseerUsername={
                newOverseerUsername
              }
              setNewOverseerUsername={
                setNewOverseerUsername
              }
              addCoOverseer={
                addCoOverseer
              }
              removeMember={
                removeMember
              }
              canManageLeague={
                canManageLeague
              }
              saving={saving}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function NavButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
        active
          ? "bg-white text-black"
          : "text-white/55 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      {children}

      {active && (
        <ChevronRight className="size-4" />
      )}
    </button>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/30">
        {eyebrow}
      </div>

      <h2 className="mt-2 text-2xl font-bold">
        {title}
      </h2>

      <p className="mt-1 max-w-2xl text-sm text-white/45">
        {description}
      </p>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <Card className="p-8 text-center">
      <div className="text-sm text-white/40">
        {text}
      </div>
    </Card>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wider text-white/35">
        {label}
      </div>

      <div className="mt-2 text-3xl font-bold">
        {value}
      </div>
    </Card>
  );
}

function StatusPill({
  status,
}: {
  status: string;
}) {
  const completed =
    status === "completed";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
        completed
          ? "bg-emerald-500/10 text-emerald-300"
          : "bg-white/10 text-white/55"
      }`}
    >
      {status}
    </span>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-4">
      <div className="text-[10px] uppercase tracking-wider text-white/30">
        {label}
      </div>

      <div className="mt-2 text-sm font-medium">
        {value}
      </div>
    </div>
  );
}

function Overview({
  league,
  divisions,
  teams,
  fixtures,
  standings,
  completedFixtures,
  scheduledFixtures,
  divisionMap,
  teamMap,
}: {
  league: League;
  divisions: Division[];
  teams: Team[];
  fixtures: Fixture[];
  standings: Standing[];
  completedFixtures: Fixture[];
  scheduledFixtures: Fixture[];
  divisionMap: Record<
    string,
    Division
  >;
  teamMap: Record<
    string,
    Team
  >;
}) {
  const nextFixture =
    scheduledFixtures[0];

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Overview"
        title={league.name}
        description="Competition control centre for divisions, fixtures, results and standings."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Divisions"
          value={divisions.length}
        />

        <StatCard
          label="Teams"
          value={teams.length}
        />

        <StatCard
          label="Fixtures"
          value={fixtures.length}
        />

        <StatCard
          label="Completed"
          value={
            completedFixtures.length
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5" />

            <h3 className="font-semibold">
              Next fixture
            </h3>
          </div>

          {nextFixture ? (
            <div className="mt-6">
              <div className="text-xs text-white/35">
                GW{" "}
                {nextFixture.gameweek ??
                  "?"}{" "}
                ·{" "}
                {divisionMap[
                  nextFixture.division_id ??
                    ""
                ]?.name ??
                  "Division"}
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                <span className="text-lg font-semibold">
                  {teamMap[
                    nextFixture.home_team_id ??
                      ""
                  ]?.name ??
                    "Home"}
                </span>

                <span className="text-sm font-bold text-white/25">
                  VS
                </span>

                <span className="text-right text-lg font-semibold">
                  {teamMap[
                    nextFixture.away_team_id ??
                      ""
                  ]?.name ??
                    "Away"}
                </span>
              </div>

              <div className="mt-5 border-t border-white/10 pt-4 text-sm text-white/45">
                {new Intl.DateTimeFormat(
                  "en-GB",
                  {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                ).format(
                  new Date(
                    nextFixture.kickoff_at,
                  ),
                )}
              </div>

              <div className="mt-2 text-xs text-white/30">
                Deadline:{" "}
                {nextFixture.deadline_at
                  ? new Intl.DateTimeFormat(
                      "en-GB",
                      {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    ).format(
                      new Date(
                        nextFixture.deadline_at,
                      ),
                    )
                  : "Not set"}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-white/[0.03] p-5 text-sm text-white/40">
              No scheduled fixtures yet.
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Trophy className="size-5" />

            <h3 className="font-semibold">
              Divisions
            </h3>
          </div>

          <div className="mt-5 space-y-3">
            {divisions.map(
              (division) => {
                const count =
                  standings.filter(
                    (row) =>
                      row.division_id ===
                      division.id,
                  ).length;

                return (
                  <div
                    key={division.id}
                    className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3"
                  >
                    <div>
                      <div className="font-medium">
                        {division.name}
                      </div>

                      <div className="text-xs text-white/35">
                        {division.status ??
                          "draft"}
                      </div>
                    </div>

                    <span className="text-sm text-white/40">
                      {count} teams
                    </span>
                  </div>
                );
              },
            )}

            {divisions.length ===
              0 && (
              <div className="text-sm text-white/40">
                No divisions yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function FixturesSection({
  fixtures,
  teamName,
  divisionName,
  formatDate,
  selectedFixtureId,
  setSelectedFixtureId,
  getResult,
  canManageLeague,
  saving,
  saveFixtureDeadline,
  overrideFixture,
  toDateTimeLocal,
}: {
  fixtures: Fixture[];
  teamName: (
    id: string | null,
  ) => string;
  divisionName: (
    id: string | null,
  ) => string;
  formatDate: (
    value: string | null,
  ) => string;
  selectedFixtureId: string | null;
  setSelectedFixtureId: (
    id: string | null,
  ) => void;
  getResult: (
    id: string,
  ) => Result | undefined;
  canManageLeague: boolean;
  saving: boolean;
  saveFixtureDeadline: (
    id: string,
    deadline: string,
  ) => Promise<void>;
  overrideFixture: (
    fixture: Fixture,
  ) => Promise<void>;
  toDateTimeLocal: (
    value: string | null,
  ) => string;
}) {
  const selectedFixture =
    fixtures.find(
      (fixture) =>
        fixture.id ===
        selectedFixtureId,
    ) ?? null;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Fixtures"
        title="Fixture schedule"
        description="Manage generated fixtures, deadlines and authorised completion overrides."
      />

      {fixtures.length ===
      0 ? (
        <EmptyState text="No fixtures have been generated for this league yet." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-white/30">
                <tr>
                  <th className="px-5 py-4 text-left">
                    GW
                  </th>
                  <th className="px-5 py-4 text-left">
                    Match
                  </th>
                  <th className="px-5 py-4 text-left">
                    Division
                  </th>
                  <th className="px-5 py-4 text-left">
                    Kickoff
                  </th>
                  <th className="px-5 py-4 text-left">
                    Deadline
                  </th>
                  <th className="px-5 py-4 text-left">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {fixtures.map(
                  (fixture) => {
                    const result =
                      getResult(
                        fixture.id,
                      );

                    const selected =
                      selectedFixtureId ===
                      fixture.id;

                    return (
                      <tr
                        key={fixture.id}
                        onClick={() =>
                          setSelectedFixtureId(
                            selected
                              ? null
                              : fixture.id,
                          )
                        }
                        className={`cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04] ${
                          selected
                            ? "bg-white/[0.05]"
                            : ""
                        }`}
                      >
                        <td className="px-5 py-4 text-white/50">
                          {fixture.gameweek ??
                            "—"}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium">
                            {teamName(
                              fixture.home_team_id,
                            )}{" "}
                            <span className="text-white/25">
                              vs
                            </span>{" "}
                            {teamName(
                              fixture.away_team_id,
                            )}
                          </div>

                          {result && (
                            <div className="mt-1 text-xs text-white/35">
                              Result recorded
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-white/50">
                          {divisionName(
                            fixture.division_id,
                          )}
                        </td>

                        <td className="px-5 py-4 text-white/50">
                          {formatDate(
                            fixture.kickoff_at,
                          )}
                        </td>

                        <td className="px-5 py-4 text-white/50">
                          {formatDate(
                            fixture.deadline_at,
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <StatusPill
                            status={
                              fixture.status
                            }
                          />
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectedFixture && (
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-white/30">
                Fixture control
              </div>

              <h3 className="mt-2 text-xl font-bold">
                {teamName(
                  selectedFixture.home_team_id,
                )}{" "}
                {selectedFixture.home_score ??
                  getResult(
                    selectedFixture.id,
                  )?.home_score ??
                  "—"}{" "}
                <span className="text-white/20">
                  -
                </span>{" "}
                {selectedFixture.away_score ??
                  getResult(
                    selectedFixture.id,
                  )?.away_score ??
                  "—"}{" "}
                {teamName(
                  selectedFixture.away_team_id,
                )}
              </h3>
            </div>

            <button
              onClick={() =>
                setSelectedFixtureId(
                  null,
                )
              }
              className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <InfoBox
              label="Gameweek"
              value={`GW ${selectedFixture.gameweek ?? "—"}`}
            />

            <InfoBox
              label="Completion"
              value={
                selectedFixture.completion_source ??
                "scheduled"
              }
            />

            <InfoBox
              label="Completed"
              value={formatDate(
                selectedFixture.completed_at,
              )}
            />
          </div>

          {canManageLeague &&
            selectedFixture.status !==
              "completed" && (
              <div className="mt-6 border-t border-white/10 pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-white/50" />

                  <h4 className="font-semibold">
                    Deadline control
                  </h4>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="datetime-local"
                    defaultValue={toDateTimeLocal(
                      selectedFixture.deadline_at,
                    )}
                    id={`deadline-${selectedFixture.id}`}
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none"
                  />

                  <button
                    disabled={saving}
                    onClick={() => {
                      const input =
                        document.getElementById(
                          `deadline-${selectedFixture.id}`,
                        ) as HTMLInputElement | null;

                      void saveFixtureDeadline(
                        selectedFixture.id,
                        input?.value ?? "",
                      );
                    }}
                    className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    Save deadline
                  </button>
                </div>

                <button
                  disabled={saving}
                  onClick={() =>
                    void overrideFixture(
                      selectedFixture,
                    )
                  }
                  className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                >
                  Complete as authorised 0-0
                </button>
              </div>
            )}

          {selectedFixture.completion_note && (
            <div className="mt-5 rounded-xl bg-white/[0.03] p-4 text-sm text-white/45">
              {selectedFixture.completion_note}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ResultsSection({
  fixtures,
  results,
  teamName,
  divisionName,
  formatDate,
}: {
  fixtures: Fixture[];
  results: Result[];
  teamName: (
    id: string | null,
  ) => string;
  divisionName: (
    id: string | null,
  ) => string;
  formatDate: (
    value: string | null,
  ) => string;
}) {
  const resultMap = useMemo(() => {
    const map: Record<
      string,
      Result
    > = {};

    for (const result of results) {
      map[result.fixture_id] =
        result;
    }

    return map;
  }, [results]);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Results"
        title="Completed results"
        description="Official completed fixtures and their recording information."
      />

      {fixtures.length ===
      0 ? (
        <EmptyState text="No completed results yet." />
      ) : (
        <div className="space-y-3">
          {fixtures.map(
            (fixture) => {
              const result =
                resultMap[
                  fixture.id
                ];

              return (
                <Card
                  key={fixture.id}
                  className="p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-xs text-white/30">
                        GW{" "}
                        {fixture.gameweek ??
                          "—"}{" "}
                        ·{" "}
                        {divisionName(
                          fixture.division_id,
                        )}
                      </div>

                      <div className="mt-2 text-lg font-bold">
                        {teamName(
                          fixture.home_team_id,
                        )}{" "}
                        <span className="text-white/30">
                          {fixture.home_score ??
                            result?.home_score ??
                            0}
                        </span>{" "}
                        -{" "}
                        <span className="text-white/30">
                          {fixture.away_score ??
                            result?.away_score ??
                            0}
                        </span>{" "}
                        {teamName(
                          fixture.away_team_id,
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-white/40 lg:text-right">
                      <div>
                        {result
                          ? `Recorded ${formatDate(result.recorded_at)}`
                          : "Automatic completion"}
                      </div>

                      <div className="mt-1 text-xs">
                        {fixture.completion_source ??
                          "manual"}
                      </div>
                    </div>
                  </div>

                  {result?.replay_code && (
                    <div className="mt-4 border-t border-white/10 pt-4 text-xs text-white/35">
                      Replay:{" "}
                      {result.replay_code}
                    </div>
                  )}

                  {result?.notes && (
                    <div className="mt-3 text-sm text-white/45">
                      {result.notes}
                    </div>
                  )}
                </Card>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

function TableSection({
  standings,
  teams,
  divisions,
  adjustments,
}: {
  standings: Standing[];
  teams: Team[];
  divisions: Division[];
  adjustments: PointAdjustment[];
}) {
  const teamMap = useMemo(() => {
    const map: Record<
      string,
      Team
    > = {};

    for (const team of teams) {
      map[team.id] = team;
    }

    return map;
  }, [teams]);

  const adjustmentMap =
    useMemo(() => {
      const map: Record<
        string,
        number
      > = {};

      for (const adjustment of adjustments) {
        const key = `${adjustment.division_id}:${adjustment.team_id}`;

        map[key] =
          (map[key] ?? 0) +
          adjustment.points_delta;
      }

      return map;
    }, [adjustments]);

  const divisionMap =
    useMemo(() => {
      const map: Record<
        string,
        Division
      > = {};

      for (const division of divisions) {
        map[division.id] =
          division;
      }

      return map;
    }, [divisions]);

  const grouped = useMemo(() => {
    const map: Record<
      string,
      Standing[]
    > = {};

    for (const row of standings) {
      if (!map[row.division_id]) {
        map[row.division_id] = [];
      }

      map[row.division_id].push(
        row,
      );
    }

    for (const rows of Object.values(
      map,
    )) {
      rows.sort(
        (a, b) =>
          b.points - a.points ||
          b.goal_difference -
            a.goal_difference ||
          b.goals_for -
            a.goals_for,
      );
    }

    return map;
  }, [standings]);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Table"
        title="League standings"
        description="Live standings including authorised point adjustments."
      />

      {Object.entries(grouped).map(
        ([divisionId, rows]) => {
          const division =
            divisionMap[
              divisionId
            ];

          return (
            <Card
              key={divisionId}
              className="overflow-hidden"
            >
              <div className="border-b border-white/10 px-5 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {division?.name ??
                        "Division"}
                    </h3>

                    <p className="mt-1 text-xs text-white/35">
                      {division?.points_tier ??
                        "unranked"}{" "}
                      scoring tier
                    </p>
                  </div>

                  <Trophy className="size-5 text-white/30" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-white/25">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        #
                      </th>
                      <th className="px-4 py-3 text-left">
                        Team
                      </th>
                      <th className="px-4 py-3">
                        P
                      </th>
                      <th className="px-4 py-3">
                        W
                      </th>
                      <th className="px-4 py-3">
                        D
                      </th>
                      <th className="px-4 py-3">
                        L
                      </th>
                      <th className="px-4 py-3">
                        GF
                      </th>
                      <th className="px-4 py-3">
                        GA
                      </th>
                      <th className="px-4 py-3">
                        GD
                      </th>
                      <th className="px-4 py-3 text-right">
                        PTS
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map(
                      (
                        row,
                        index,
                      ) => {
                        const adjustment =
                          adjustmentMap[
                            `${divisionId}:${row.team_id}`
                          ] ?? 0;

                        return (
                          <tr
                            key={row.id}
                            className="border-t border-white/5"
                          >
                            <td className="px-4 py-4 text-white/35">
                              {index + 1}
                            </td>

                            <td className="px-4 py-4 font-medium">
                              {teamMap[
                                row.team_id
                              ]?.name ??
                                "Unknown"}
                            </td>

                            <td className="px-4 py-4 text-center text-white/50">
                              {row.played}
                            </td>

                            <td className="px-4 py-4 text-center text-white/50">
                              {row.won}
                            </td>

                            <td className="px-4 py-4 text-center text-white/50">
                              {row.drawn}
                            </td>

                            <td className="px-4 py-4 text-center text-white/50">
                              {row.lost}
                            </td>

                            <td className="px-4 py-4 text-center text-white/50">
                              {row.goals_for}
                            </td>

                            <td className="px-4 py-4 text-center text-white/50">
                              {row.goals_against}
                            </td>

                            <td className="px-4 py-4 text-center">
                              {row.goal_difference >
                              0
                                ? `+${row.goal_difference}`
                                : row.goal_difference}
                            </td>

                            <td className="px-4 py-4 text-right font-bold">
                              {row.points}

                              {adjustment !==
                                0 && (
                                <span
                                  className={`ml-2 text-xs font-medium ${
                                    adjustment <
                                    0
                                      ? "text-red-400"
                                      : "text-emerald-400"
                                  }`}
                                >
                                  (
                                  {adjustment >
                                  0
                                    ? "+"
                                    : ""}
                                  {
                                    adjustment
                                  }
                                  )
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        },
      )}

      {Object.keys(grouped)
        .length === 0 && (
        <EmptyState text="Standings will appear here once divisions and teams are active." />
      )}
    </div>
  );
}

function TeamsSection({
  teams,
  divisions,
  profiles,
  teamStaff,
}: {
  teams: Team[];
  divisions: Division[];
  profiles: Record<
    string,
    Profile
  >;
  teamStaff: TeamStaff[];
}) {
  const divisionMap = useMemo(
    () => {
      const map: Record<
        string,
        Division
      > = {};

      for (const division of divisions) {
        map[division.id] =
          division;
      }

      return map;
    },
    [divisions],
  );

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Teams"
        title="League teams"
        description="Every registered team, its division, manager and co-managers."
      />

      {teams.length ===
      0 ? (
        <EmptyState text="No teams are registered in this league yet." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {teams.map((team) => {
            const manager =
              team.manager_id
                ? profiles[
                    team.manager_id
                  ]
                : null;

            const coManagers =
              teamStaff.filter(
                (staff) =>
                  staff.team_id ===
                    team.id &&
                  staff.role ===
                    "co_manager",
              );

            return (
              <Card
                key={team.id}
                className="p-5"
              >
                <div className="flex items-start gap-4">
                  {team.logo_url ? (
                    <img
                      src={team.logo_url}
                      alt=""
                      className="size-12 rounded-xl bg-white/5 object-contain"
                    />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-xl bg-white/10">
                      <Users className="size-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">
                        {team.name}
                      </h3>

                      {team.short_name && (
                        <span className="text-xs text-white/30">
                          {team.short_name}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-xs text-white/35">
                      {divisionMap[
                        team.division_id ??
                          ""
                      ]?.name ??
                        "Unassigned division"}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/[0.03] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-white/30">
                      Manager
                    </div>

                    <div className="mt-2 text-sm font-medium">
                      {manager?.display_name ??
                        manager?.username ??
                        "Unassigned"}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-white/30">
                      Co-Managers
                    </div>

                    {coManagers.length >
                    0 ? (
                      <div className="mt-2 space-y-1">
                        {coManagers.map(
                          (staff) => {
                            const profile =
                              profiles[
                                staff.user_id
                              ];

                            return (
                              <div
                                key={
                                  staff.id
                                }
                                className="text-sm font-medium"
                              >
                                {profile?.display_name ??
                                  profile?.username ??
                                  "Unknown"}
                              </div>
                            );
                          },
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-white/35">
                        None
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DivisionsSection({
  divisions,
  teams,
  isOwner,
  canManageLeague,
  newDivisionName,
  setNewDivisionName,
  newDivisionTier,
  setNewDivisionTier,
  createDivision,
  updateDivisionTier,
  changeDivisionStatus,
  saving,
}: {
  divisions: Division[];
  teams: Team[];
  isOwner: boolean;
  canManageLeague: boolean;
  newDivisionName: string;
  setNewDivisionName: (
    value: string,
  ) => void;
  newDivisionTier: string;
  setNewDivisionTier: (
    value: string,
  ) => void;
  createDivision: () => Promise<void>;
  updateDivisionTier: (
    id: string,
    tier: Division["points_tier"],
  ) => Promise<void>;
  changeDivisionStatus: (
    id: string,
    status: string,
  ) => Promise<void>;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Divisions"
        title="Division control"
        description="Create divisions, start or end them, and configure NOVA Points scoring tiers."
      />

      {canManageLeague && (
        <Card className="p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
            <input
              value={newDivisionName}
              onChange={(event) =>
                setNewDivisionName(
                  event.target.value,
                )
              }
              placeholder="Division name"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/25"
            />

            <select
              value={newDivisionTier}
              onChange={(event) =>
                setNewDivisionTier(
                  event.target.value,
                )
              }
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none"
            >
              <option
                value="1"
                className="bg-black"
              >
                Tier 1
              </option>

              <option
                value="2"
                className="bg-black"
              >
                Tier 2
              </option>

              <option
                value="3"
                className="bg-black"
              >
                Tier 3
              </option>
            </select>

            <button
              onClick={() =>
                void createDivision()
              }
              disabled={saving}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </Card>
      )}

      <div className="grid gap-4">
        {divisions.map(
          (division) => {
            const teamCount =
              teams.filter(
                (team) =>
                  team.division_id ===
                  division.id,
              ).length;

            return (
              <Card
                key={division.id}
                className="p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold">
                        {division.name}
                      </h3>

                      <StatusPill
                        status={
                          division.status ??
                          "draft"
                        }
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/35">
                      <span>
                        Tier{" "}
                        {division.tier ??
                          "—"}
                      </span>

                      <span>
                        {teamCount} teams
                      </span>

                      <span>
                        GW every{" "}
                        {division.gameweek_interval_days ??
                          3}{" "}
                        days
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/30">
                        Points tier
                      </label>

                      <select
                        value={
                          division.points_tier ??
                          "unranked"
                        }
                        disabled={
                          !isOwner ||
                          saving
                        }
                        onChange={(
                          event,
                        ) =>
                          void updateDivisionTier(
                            division.id,
                            event.target
                              .value as Division["points_tier"],
                          )
                        }
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none disabled:opacity-50"
                      >
                        {TIER_OPTIONS.map(
                          (option) => (
                            <option
                              key={
                                option.value
                              }
                              value={
                                option.value
                              }
                              className="bg-black"
                            >
                              {
                                option.label
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    {canManageLeague && (
                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/30">
                          Status
                        </label>

                        <select
                          value={
                            division.status ??
                            "draft"
                          }
                          disabled={
                            saving
                          }
                          onChange={(
                            event,
                          ) =>
                            void changeDivisionStatus(
                              division.id,
                              event.target
                                .value,
                            )
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none disabled:opacity-50"
                        >
                          <option
                            value="draft"
                            className="bg-black"
                          >
                            Draft
                          </option>

                          <option
                            value="active"
                            className="bg-black"
                          >
                            Active
                          </option>

                          <option
                            value="ended"
                            className="bg-black"
                          >
                            Ended
                          </option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          },
        )}

        {divisions.length ===
          0 && (
          <EmptyState text="Create the first division to start building the league." />
        )}
      </div>
    </div>
  );
}

function DeductionsSection({
  divisions,
  teams,
  adjustments,
  profiles,
  deductionDivisionId,
  setDeductionDivisionId,
  deductionTeamId,
  setDeductionTeamId,
  deductionAmount,
  setDeductionAmount,
  deductionReason,
  setDeductionReason,
  applyDeduction,
  canManageLeague,
  saving,
}: {
  divisions: Division[];
  teams: Team[];
  adjustments: PointAdjustment[];
  profiles: Record<
    string,
    Profile
  >;
  deductionDivisionId: string;
  setDeductionDivisionId: (
    value: string,
  ) => void;
  deductionTeamId: string;
  setDeductionTeamId: (
    value: string,
  ) => void;
  deductionAmount: string;
  setDeductionAmount: (
    value: string,
  ) => void;
  deductionReason: string;
  setDeductionReason: (
    value: string,
  ) => void;
  applyDeduction: () => Promise<void>;
  canManageLeague: boolean;
  saving: boolean;
}) {
  const divisionTeams =
    teams.filter(
      (team) =>
        team.division_id ===
        deductionDivisionId,
    );

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Discipline"
        title="Table point adjustments"
        description="Apply or restore table points through the existing secure standings RPC."
      />

      {canManageLeague ? (
        <Card className="p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-white/30">
                Division
              </label>

              <select
                value={
                  deductionDivisionId
                }
                onChange={(event) => {
                  setDeductionDivisionId(
                    event.target.value,
                  );
                  setDeductionTeamId("");
                }}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none"
              >
                <option
                  value=""
                  className="bg-black"
                >
                  Select division
                </option>

                {divisions.map(
                  (division) => (
                    <option
                      key={division.id}
                      value={division.id}
                      className="bg-black"
                    >
                      {division.name}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-white/30">
                Team
              </label>

              <select
                value={
                  deductionTeamId
                }
                onChange={(event) =>
                  setDeductionTeamId(
                    event.target.value,
                  )
                }
                disabled={
                  !deductionDivisionId
                }
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none disabled:opacity-40"
              >
                <option
                  value=""
                  className="bg-black"
                >
                  Select team
                </option>

                {divisionTeams.map(
                  (team) => (
                    <option
                      key={team.id}
                      value={team.id}
                      className="bg-black"
                    >
                      {team.name}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-white/30">
                Points
              </label>

              <input
                type="number"
                value={
                  deductionAmount
                }
                onChange={(event) =>
                  setDeductionAmount(
                    event.target.value,
                  )
                }
                placeholder="-3 or +3"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/25"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-white/30">
                Reason
              </label>

              <input
                value={
                  deductionReason
                }
                onChange={(event) =>
                  setDeductionReason(
                    event.target.value,
                  )
                }
                placeholder="Failed to fulfil fixture"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/25"
              />
            </div>
          </div>

          <button
            onClick={() =>
              void applyDeduction()
            }
            disabled={
              saving ||
              !deductionTeamId
            }
            className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
          >
            Apply adjustment
          </button>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="text-sm text-white/45">
            You can view point adjustments, but you don't have permission to apply them.
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-white/10 px-5 py-5">
          <h3 className="font-semibold">
            Adjustment history
          </h3>
        </div>

        {adjustments.length ===
        0 ? (
          <div className="p-6 text-sm text-white/40">
            No point adjustments have been recorded.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {adjustments.map(
              (adjustment) => {
                const profile =
                  adjustment.applied_by
                    ? profiles[
                        adjustment.applied_by
                      ]
                    : null;

                const team =
                  teams.find(
                    (item) =>
                      item.id ===
                      adjustment.team_id,
                  );

                return (
                  <div
                    key={
                      adjustment.id
                    }
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        {team?.name ??
                          "Unknown team"}
                      </div>

                      <div className="mt-1 text-sm text-white/40">
                        {
                          adjustment.reason
                        }
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <div
                        className={`font-bold ${
                          adjustment.points_delta <
                          0
                            ? "text-red-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {adjustment.points_delta >
                        0
                          ? "+"
                          : ""}
                        {
                          adjustment.points_delta
                        }{" "}
                        pts
                      </div>

                      <div className="mt-1 text-xs text-white/30">
                        {profile?.display_name ??
                          profile?.username ??
                          "NOVA staff"}
                        {" · "}
                        {new Intl.DateTimeFormat(
                          "en-GB",
                          {
                            day: "2-digit",
                            month:
                              "short",
                            year:
                              "numeric",
                          },
                        ).format(
                          new Date(
                            adjustment.created_at,
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function OverseersSection({
  members,
  profiles,
  newOverseerUsername,
  setNewOverseerUsername,
  addCoOverseer,
  removeMember,
  canManageLeague,
  saving,
}: {
  members: LeagueMember[];
  profiles: Record<
    string,
    Profile
  >;
  newOverseerUsername: string;
  setNewOverseerUsername: (
    value: string,
  ) => void;
  addCoOverseer: () => Promise<void>;
  removeMember: (
    id: string,
  ) => Promise<void>;
  canManageLeague: boolean;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Staff"
        title="League overseers"
        description="Manage the people authorised to operate this league."
      />

      {canManageLeague && (
        <Card className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={
                newOverseerUsername
              }
              onChange={(event) =>
                setNewOverseerUsername(
                  event.target.value,
                )
              }
              placeholder="NOVA username or Discord ID"
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/25"
            />

            <button
              onClick={() =>
                void addCoOverseer()
              }
              disabled={saving}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              Add Co-Overseer
            </button>
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {members.map(
          (member) => {
            const profile =
              profiles[
                member.user_id
              ];

            return (
              <Card
                key={member.id}
                className="p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Shield className="size-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {profile?.display_name ??
                          profile?.username ??
                          "Unknown user"}
                      </div>

                      <div className="mt-1 text-xs text-white/35">
                        {member.role ===
                        "co_overseer"
                          ? "Co-Overseer"
                          : "Overseer"}
                      </div>
                    </div>
                  </div>

                  {canManageLeague &&
                    member.role ===
                      "co_overseer" && (
                      <button
                        onClick={() =>
                          void removeMember(
                            member.id,
                          )
                        }
                        disabled={
                          saving
                        }
                        className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                </div>
              </Card>
            );
          },
        )}

        {members.length ===
          0 && (
          <EmptyState text="No league staff have been assigned." />
        )}
      </div>
    </div>
  );
}
