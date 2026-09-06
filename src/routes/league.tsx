import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Loader2,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  Users,
  Wallet,
  Radio,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
type League = {
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
  logo_url?: string | null;
  description?: string | null;
  season?: string | null;
};
type Division = {
  id: string;
  league_id: string;
  name: string;
  tier?: number | null;
  season?: string | null;
  status?: string | null;
  gameweek_interval_days?: number | null;
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
  discord_id?: string | null;
};
type LeagueMember = {
  id?: string;
  league_id: string;
  user_id?: string;
  role: "overseer" | "co_overseer";
};
type LeagueSettings = {
  league_id: string;
  max_roster_size: number | null;
  default_transfer_budget: number | null;
  transfer_window_start: string | null;
  transfer_window_end: string | null;
  gameweek_interval_days: number | null;
};
type ChannelSettings = {
  league_id: string;
  fixtures_channel_id: string | null;
  results_channel_id: string | null;
  table_channel_id: string | null;
  signings_channel_id: string | null;
  releases_channel_id: string | null;
  budgets_channel_id: string | null;
  transfers_channel_id: string | null;
  loans_channel_id: string | null;
  transfer_window_channel_id: string | null;
  announcements_channel_id: string | null;
};
type GuildSettings = {
  guild_id: string;
  guild_name: string | null;
  league_id: string | null;
  manager_role_id: string | null;
  co_manager_role_id: string | null;
};
type Section =
  | "overview"
  | "teams"
  | "divisions"
  | "settings"
  | "transfers"
  | "discord"
  | "overseers";
const NOVA_OWNER_IDENTIFIER = "aa23fr";
const TIER_OPTIONS = [
  { value: 1, label: "Elite" },
  { value: 2, label: "Tier 2" },
  { value: 3, label: "Tier 3" },
];
function getTierLabel(tier: number | null | undefined) {
  return TIER_OPTIONS.find((option) => option.value === tier)?.label ?? "Elite";
}
export const Route = createFileRoute("/league")({
  ssr: false,
  component: LeaguePanel,
});
function LeaguePanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDiscordRoles, setSavingDiscordRoles] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [memberRole, setMemberRole] = useState<
    "overseer" | "co_overseer" | null
  >(null);
  const [isNovaAdmin, setIsNovaAdmin] = useState(false);
  const [isNovaOwner, setIsNovaOwner] = useState(false);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [confirmedTeams, setConfirmedTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [settings, setSettings] = useState<LeagueSettings>({
    league_id: "",
    max_roster_size: 20,
    default_transfer_budget: 0,
    transfer_window_start: null,
    transfer_window_end: null,
    gameweek_interval_days: 3,
  });
  const [channels, setChannels] = useState<ChannelSettings>({
    league_id: "",
    fixtures_channel_id: null,
    results_channel_id: null,
    table_channel_id: null,
    signings_channel_id: null,
    releases_channel_id: null,
    budgets_channel_id: null,
    transfers_channel_id: null,
    loans_channel_id: null,
    transfer_window_channel_id: null,
    announcements_channel_id: null,
  });
  const [guildSettings, setGuildSettings] = useState<GuildSettings | null>(
    null,
  );
  const [managerRoleId, setManagerRoleId] = useState("");
  const [coManagerRoleId, setCoManagerRoleId] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [teamResults, setTeamResults] = useState<Team[]>([]);
  const [searchingTeams, setSearchingTeams] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState("");
  const [creatingDivision, setCreatingDivision] = useState(false);
  const [newCoOverseer, setNewCoOverseer] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<Profile[]>(
    [],
  );
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const canManageTiers = isNovaAdmin || isNovaOwner;
  useEffect(() => {
    void loadPanel();
  }, []);
  async function loadPanel() {
    try {
      setLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        void navigate({ to: "/auth" });
        return;
      }
      let admin = false;
      let owner = false;
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      admin = (roleData ?? []).some(
        (row) => String(row.role).toLowerCase() === "admin",
      );
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("id,username,discord_id")
        .eq("id", user.id)
        .maybeSingle();
      if (
        user.id === NOVA_OWNER_IDENTIFIER ||
        ownerProfile?.username === NOVA_OWNER_IDENTIFIER ||
        ownerProfile?.discord_id === NOVA_OWNER_IDENTIFIER
      ) {
        owner = true;
      }
      setIsNovaAdmin(admin);
      setIsNovaOwner(owner);
      const { data: memberships, error: membershipError } = await supabase
        .from("league_members")
        .select("id,league_id,user_id,role")
        .eq("user_id", user.id)
        .in("role", ["overseer", "co_overseer"]);
      if (membershipError) {
        setError(
          `Couldn't check league permissions: ${membershipError.message}`,
        );
        return;
      }
      const memberRows = (memberships ?? []) as LeagueMember[];
      if (memberRows.length === 0 && !admin && !owner) {
        setAccessDenied(true);
        return;
      }
      let membership = memberRows[0];
      if (!membership) {
        const { data: firstLeagueMember } = await supabase
          .from("league_members")
          .select("id,league_id,user_id,role")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!firstLeagueMember) {
          setAccessDenied(true);
          return;
        }
        membership = firstLeagueMember as LeagueMember;
      }
      const { data: leagueData, error: leagueError } = await supabase
        .from("leagues")
        .select("id,name,slug,status,logo_url,description,season")
        .eq("id", membership.league_id)
        .maybeSingle();
      if (leagueError) {
        setError(`Couldn't load your league: ${leagueError.message}`);
        return;
      }
      if (!leagueData) {
        setError("Your league could not be found.");
        return;
      }
      const currentLeague = leagueData as League;
      setLeague(currentLeague);
      setMemberRole(membership.role);
      const [
        divisionResponse,
        teamResponse,
        settingsResponse,
        channelResponse,
        membersResponse,
        guildSettingsResponse,
      ] = await Promise.all([
        supabase
          .from("divisions")
          .select(
            "id,league_id,name,tier,season,status,gameweek_interval_days",
          )
          .eq("league_id", currentLeague.id)
          .order("tier", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("teams")
          .select(
            "id,name,short_name,logo_url,league_id,division_id,manager_id",
          )
          .eq("league_id", currentLeague.id)
          .order("name", { ascending: true }),
        supabase
          .from("league_settings")
          .select(
            "league_id,max_roster_size,default_transfer_budget,transfer_window_start,transfer_window_end,gameweek_interval_days",
          )
          .eq("league_id", currentLeague.id)
          .maybeSingle(),
        supabase
          .from("league_channel_settings")
          .select(
            "league_id,fixtures_channel_id,results_channel_id,table_channel_id,signings_channel_id,releases_channel_id,budgets_channel_id,transfers_channel_id,loans_channel_id,transfer_window_channel_id,announcements_channel_id",
          )
          .eq("league_id", currentLeague.id)
          .maybeSingle(),
        supabase
          .from("league_members")
          .select("id,league_id,user_id,role")
          .eq("league_id", currentLeague.id)
          .order("role", { ascending: true }),
        supabase
          .from("guild_settings")
          .select(
            "guild_id,guild_name,league_id,manager_role_id,co_manager_role_id",
          )
          .eq("league_id", currentLeague.id)
          .limit(1)
          .maybeSingle(),
      ]);
      if (divisionResponse.error) {
        setError(`Couldn't load divisions: ${divisionResponse.error.message}`);
        return;
      }
      if (teamResponse.error) {
        setError(`Couldn't load teams: ${teamResponse.error.message}`);
        return;
      }
      setDivisions((divisionResponse.data ?? []) as Division[]);
      setConfirmedTeams((teamResponse.data ?? []) as Team[]);
      if (settingsResponse.error) {
        console.warn(
          "League settings could not be loaded:",
          settingsResponse.error,
        );
      } else if (settingsResponse.data) {
        setSettings({
          ...(settingsResponse.data as LeagueSettings),
          gameweek_interval_days:
            settingsResponse.data.gameweek_interval_days ?? 3,
        });
      } else {
        setSettings({
          league_id: currentLeague.id,
          max_roster_size: 20,
          default_transfer_budget: 0,
          transfer_window_start: null,
          transfer_window_end: null,
          gameweek_interval_days: 3,
        });
      }
      if (!channelResponse.error && channelResponse.data) {
        setChannels(channelResponse.data as ChannelSettings);
      } else {
        setChannels({
          league_id: currentLeague.id,
          fixtures_channel_id: null,
          results_channel_id: null,
          table_channel_id: null,
          signings_channel_id: null,
          releases_channel_id: null,
          budgets_channel_id: null,
          transfers_channel_id: null,
          loans_channel_id: null,
          transfer_window_channel_id: null,
          announcements_channel_id: null,
        });
      }
      if (!guildSettingsResponse.error && guildSettingsResponse.data) {
        const guild = guildSettingsResponse.data as GuildSettings;
        setGuildSettings(guild);
        setManagerRoleId(guild.manager_role_id ?? "");
        setCoManagerRoleId(guild.co_manager_role_id ?? "");
      } else {
        setGuildSettings(null);
        setManagerRoleId("");
        setCoManagerRoleId("");
      }
      const memberList = (membersResponse.data ?? []) as LeagueMember[];
      setMembers(memberList);
      const managerIds = (teamResponse.data ?? [])
        .map((team) => (team as Team).manager_id)
        .filter((id): id is string => Boolean(id));
      const memberIds = memberList
        .map((member) => member.user_id)
        .filter((id): id is string => Boolean(id));
      const profileIds = [...new Set([...managerIds, ...memberIds])];
      if (profileIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id,display_name,username,discord_id")
          .in("id", profileIds);
        const profileMap: Record<string, Profile> = {};
        for (const profile of (profileData ?? []) as Profile[]) {
          profileMap[profile.id] = profile;
        }
        setProfiles(profileMap);
      } else {
        setProfiles({});
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading the League Panel.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function saveDiscordRoles() {
    if (!league) return;
    if (!guildSettings?.guild_id) {
      setError(
        "No Discord server is connected to this league yet. Run /setup in the league's Discord server first.",
      );
      return;
    }
    setSavingDiscordRoles(true);
    setError(null);
    setSuccess(null);
    const payload = {
      manager_role_id: managerRoleId.trim() || null,
      co_manager_role_id: coManagerRoleId.trim() || null,
    };
    const { data, error: saveError } = await supabase
      .from("guild_settings")
      .update(payload)
      .eq("guild_id", guildSettings.guild_id)
      .eq("league_id", league.id)
      .select(
        "guild_id,guild_name,league_id,manager_role_id,co_manager_role_id",
      )
      .single();
    if (saveError) {
      setError(`Couldn't save Discord roles: ${saveError.message}`);
      setSavingDiscordRoles(false);
      return;
    }
    setGuildSettings(data as GuildSettings);
    setManagerRoleId(data.manager_role_id ?? "");
    setCoManagerRoleId(data.co_manager_role_id ?? "");
    setSavingDiscordRoles(false);
    setSuccess("Manager and Co-Manager Discord roles saved.");
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
      console.error(searchError);
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
    setSuccess(null);
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
    setSuccess(`${updatedTeam.name} has been confirmed in the league.`);
  }
  async function removeTeam(team: Team) {
    if (!league) return;
    const confirmed = window.confirm(
      `Remove ${team.name} from ${league.name}?`,
    );
    if (!confirmed) return;
    setError(null);
    setSuccess(null);
    const { error: updateError } = await supabase
      .from("teams")
      .update({
        league_id: null,
        division_id: null,
      })
      .eq("id", team.id)
      .eq("league_id", league.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setConfirmedTeams((current) =>
      current.filter((item) => item.id !== team.id),
    );
    setSuccess(`${team.name} has been removed from the league.`);
  }
  async function createDivision() {
    if (!league || !newDivisionName.trim()) return;
    setCreatingDivision(true);
    setError(null);
    setSuccess(null);
    let selectedTier = 1;
    const usedTiers = new Set(
      divisions
        .map((division) => division.tier ?? 1)
        .filter((tier) => tier >= 1 && tier <= 3),
    );
    const nextAvailableTier = TIER_OPTIONS.find(
      (option) => !usedTiers.has(option.value),
    );
    if (!nextAvailableTier) {
      setError(
        "All three division tiers already exist. NOVA only supports Elite, Tier 2 and Tier 3.",
      );
      setCreatingDivision(false);
      return;
    }
    selectedTier = nextAvailableTier.value;
    const { data, error: createError } = await supabase
      .from("divisions")
      .insert({
        league_id: league.id,
        name: newDivisionName.trim(),
        tier: selectedTier,
        season: league.season,
        status: "draft",
        gameweek_interval_days:
          settings.gameweek_interval_days || 3,
      })
      .select(
        "id,league_id,name,tier,season,status,gameweek_interval_days",
      )
      .single();
    if (createError) {
      setError(createError.message);
      setCreatingDivision(false);
      return;
    }
    setDivisions((current) =>
      [...current, data as Division].sort(
        (a, b) =>
          (a.tier ?? 1) - (b.tier ?? 1) ||
          a.name.localeCompare(b.name),
      ),
    );
    setNewDivisionName("");
    setCreatingDivision(false);
    setSuccess(
      `${data.name} has been created as ${getTierLabel(data.tier)}.`,
    );
  }
  async function updateDivisionTier(
    division: Division,
    tier: number,
  ) {
    if (!league || !canManageTiers) return;
    if (![1, 2, 3].includes(tier)) {
      setError("Invalid division tier.");
      return;
    }
    const conflictingDivision = divisions.find(
      (item) =>
        item.id !== division.id &&
        (item.tier ?? 1) === tier,
    );
    if (conflictingDivision) {
      setError(
        `${getTierLabel(tier)} is already assigned to ${conflictingDivision.name}.`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { data, error: updateError } = await supabase
      .from("divisions")
      .update({ tier })
      .eq("id", division.id)
      .eq("league_id", league.id)
      .select(
        "id,league_id,name,tier,season,status,gameweek_interval_days",
      )
      .single();
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    setDivisions((current) =>
      current
        .map((item) =>
          item.id === division.id ? (data as Division) : item,
        )
        .sort(
          (a, b) =>
            (a.tier ?? 1) - (b.tier ?? 1) ||
            a.name.localeCompare(b.name),
        ),
    );
    setSaving(false);
    setSuccess(
      `${division.name} is now ${getTierLabel(tier)}.`,
    );
  }
  async function deleteDivision(division: Division) {
    if (!league) return;
    const divisionTeams = confirmedTeams.filter(
      (team) => team.division_id === division.id,
    );
    if (divisionTeams.length > 0) {
      setError(
        `You cannot delete ${division.name} while it still has teams in it.`,
      );
      return;
    }
    const confirmed = window.confirm(
      `Delete the ${division.name} division?`,
    );
    if (!confirmed) return;
    setError(null);
    setSuccess(null);
    const { error: deleteError } = await supabase
      .from("divisions")
      .delete()
      .eq("id", division.id)
      .eq("league_id", league.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setDivisions((current) =>
      current.filter((item) => item.id !== division.id),
    );
    setSuccess(`${division.name} has been deleted.`);
  }
  async function saveLeagueSettings() {
    if (!league) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const payload = {
      league_id: league.id,
      max_roster_size: Number(settings.max_roster_size) || 1,
      default_transfer_budget:
        Number(settings.default_transfer_budget) || 0,
      transfer_window_start:
        settings.transfer_window_start || null,
      transfer_window_end:
        settings.transfer_window_end || null,
      gameweek_interval_days:
        Number(settings.gameweek_interval_days) || 3,
    };
    const { error: saveError } = await supabase
      .from("league_settings")
      .upsert(payload, { onConflict: "league_id" });
    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }
    setSettings((current) => ({
      ...current,
      ...payload,
    }));
    setSaving(false);
    setSuccess("League settings saved.");
  }
  async function saveChannels() {
    if (!league) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: saveError } = await supabase
      .from("league_channel_settings")
      .upsert(
        {
          ...channels,
          league_id: league.id,
        },
        { onConflict: "league_id" },
      );
    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setSuccess("Discord channel settings saved.");
  }
  async function searchMembers(value: string) {
    setNewCoOverseer(value);
    if (!value.trim()) {
      setMemberSearchResults([]);
      return;
    }
    setSearchingMembers(true);
    const { data, error: searchError } = await supabase
      .from("profiles")
      .select("id,display_name,username,discord_id")
      .or(
        `username.ilike.%${value.trim()}%,display_name.ilike.%${value.trim()}%`,
      )
      .limit(10);
    if (searchError) {
      console.error(searchError);
      setMemberSearchResults([]);
      setSearchingMembers(false);
      return;
    }
    setMemberSearchResults((data ?? []) as Profile[]);
    setSearchingMembers(false);
  }
  async function addCoOverseer(profile: Profile) {
    if (!league) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const alreadyMember = members.some(
      (member) => member.user_id === profile.id,
    );
    if (alreadyMember) {
      setError("That user is already a member of this league.");
      setSaving(false);
      return;
    }
    const { data, error: insertError } = await supabase
      .from("league_members")
      .insert({
        league_id: league.id,
        user_id: profile.id,
        role: "co_overseer",
      })
      .select("id,league_id,user_id,role")
      .single();
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }
    setMembers((current) => [...current, data as LeagueMember]);
    setNewCoOverseer("");
    setMemberSearchResults([]);
    setSaving(false);
    setSuccess(
      `${profile.display_name || profile.username || "User"} is now a Co-Overseer.`,
    );
  }
  async function removeCoOverseer(member: LeagueMember) {
    if (!league || member.role !== "co_overseer" || !member.id) return;
    const profile = member.user_id ? profiles[member.user_id] : null;
    const confirmed = window.confirm(
      `Remove ${profile?.display_name || profile?.username || "this Co-Overseer"}?`,
    );
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: deleteError } = await supabase
      .from("league_members")
      .delete()
      .eq("id", member.id)
      .eq("league_id", league.id)
      .eq("role", "co_overseer");
    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }
    setMembers((current) =>
      current.filter((item) => item.id !== member.id),
    );
    setSaving(false);
    setSuccess("Co-Overseer removed.");
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
    return profile.display_name || profile.username || "Manager";
  }
  function channelInput(
    label: string,
    key: keyof Omit<ChannelSettings, "league_id">,
  ) {
    return (
      <div>
        <label className="text-sm font-semibold">{label}</label>
        <input
          value={channels[key] ?? ""}
          onChange={(event) =>
            setChannels((current) => ({
              ...current,
              [key]: event.target.value || null,
            }))
          }
          placeholder="Discord channel ID"
          className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-primary/20"
        />
      </div>
    );
  }
  function sectionButton(
    id: Section,
    label: string,
    icon: React.ReactNode,
  ) {
    return (
      <button
        onClick={() => setActiveSection(id)}
        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
          activeSection === id
            ? "bg-primary text-primary-foreground"
            : "hover:bg-accent"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  }
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading League Panel...
          </p>
        </div>
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
            Your account is not currently assigned as an Overseer or
            Co-Overseer of a league.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => void loadPanel()}
              className="rounded-lg border bg-card px-4 py-2.5 text-sm font-semibold"
            >
              Try again
            </button>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Return home
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }
  if (error && !league) {
    return (
      <main className="min-h-screen bg-background px-5 py-10">
        <div className="mx-auto max-w-xl">
          <div className="rounded-2xl border bg-card p-6 md:p-8">
            <CircleAlert className="size-7 text-destructive" />
            <h1 className="mt-5 text-2xl font-bold">
              League Panel couldn't load
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {error}
            </p>
            <button
              onClick={() => void loadPanel()}
              className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }
  if (!league) return null;
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
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                {memberRole === "overseer" ? "Overseer" : "Co-Overseer"}
              </span>
              {league.status && (
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {league.status}
                </span>
              )}
              {league.season && (
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {league.season}
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
        {(error || success) && (
          <div className="mt-6">
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
                <Check className="size-4" />
                {success}
              </div>
            )}
          </div>
        )}
        <div className="mt-8 grid gap-6 lg:grid-cols-[230px_1fr]">
          <aside className="h-fit rounded-2xl border bg-card p-2">
            {sectionButton(
              "overview",
              "Overview",
              <Shield className="size-4" />,
            )}
            {sectionButton(
              "teams",
              "Teams",
              <Users className="size-4" />,
            )}
            {sectionButton(
              "divisions",
              "Divisions",
              <CalendarDays className="size-4" />,
            )}
            {sectionButton(
              "settings",
              "League Settings",
              <Settings className="size-4" />,
            )}
            {sectionButton(
              "transfers",
              "Transfers & Budget",
              <Wallet className="size-4" />,
            )}
            {sectionButton(
              "discord",
              "Discord",
              <Radio className="size-4" />,
            )}
            {sectionButton(
              "overseers",
              "Overseers",
              <Shield className="size-4" />,
            )}
          </aside>
          <section className="min-w-0">
            {activeSection === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard
                    label="Teams"
                    value={confirmedTeams.length}
                    icon={<Users className="size-5" />}
                  />
                  <StatCard
                    label="Divisions"
                    value={divisions.length}
                    icon={<CalendarDays className="size-5" />}
                  />
                  <StatCard
                    label="Max Roster"
                    value={settings.max_roster_size ?? 20}
                    icon={<Users className="size-5" />}
                  />
                  <StatCard
                    label="Gameweek Interval"
                    value={`${settings.gameweek_interval_days ?? 3}d`}
                    icon={<CalendarDays className="size-5" />}
                  />
                </div>
                <div className="rounded-2xl border bg-card p-6">
                  <h2 className="text-xl font-bold">
                    League control centre
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Manage your league's divisions, participating teams,
                    transfer rules, budgets, Discord configuration and
                    Co-Overseers from one place.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <QuickAction
                      title="Manage teams"
                      description="Confirm teams and assign divisions."
                      onClick={() => setActiveSection("teams")}
                    />
                    <QuickAction
                      title="Manage divisions"
                      description="Create and organise divisions."
                      onClick={() => setActiveSection("divisions")}
                    />
                    <QuickAction
                      title="League settings"
                      description="Roster size and gameweek rules."
                      onClick={() => setActiveSection("settings")}
                    />
                    <QuickAction
                      title="Transfer settings"
                      description="Budgets and transfer windows."
                      onClick={() => setActiveSection("transfers")}
                    />
                    <QuickAction
                      title="Discord settings"
                      description="Configure channels and staff roles."
                      onClick={() => setActiveSection("discord")}
                    />
                    <QuickAction
                      title="Co-Overseers"
                      description="Manage your league staff."
                      onClick={() => setActiveSection("overseers")}
                    />
                  </div>
                </div>
              </div>
            )}
            {activeSection === "teams" && (
              <div className="space-y-6">
                <div className="rounded-2xl border bg-card p-6">
                  <h2 className="text-xl font-bold">
                    Confirm a NOVA team
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Search for any team registered on NOVA, select it, choose
                    its division, then confirm it into this league.
                  </p>
                  <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_240px_auto]">
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={teamSearch}
                          onChange={(event) =>
                            void searchTeams(event.target.value)
                          }
                          placeholder="Search registered teams..."
                          className="w-full rounded-xl border bg-background py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        {searchingTeams && (
                          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {teamResults.length > 0 && !selectedTeam && (
                        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border bg-card p-1 shadow-xl">
                          {teamResults.map((team) => (
                            <button
                              key={team.id}
                              onClick={() => {
                                setSelectedTeam(team);
                                setTeamResults([]);
                                setTeamSearch(team.name);
                              }}
                              className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition hover:bg-accent"
                            >
                              {team.logo_url ? (
                                <img
                                  src={team.logo_url}
                                  alt=""
                                  className="size-9 rounded-full object-contain"
                                />
                              ) : (
                                <div className="grid size-9 place-items-center rounded-full border">
                                  <Users className="size-4" />
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-semibold">
                                  {team.name}
                                </p>
                                {team.short_name && (
                                  <p className="text-xs text-muted-foreground">
                                    {team.short_name}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <select
                      value={selectedDivisionId}
                      onChange={(event) =>
                        setSelectedDivisionId(event.target.value)
                      }
                      className="rounded-xl border bg-background px-3 py-3 text-sm outline-none"
                    >
                      <option value="">Select division</option>
                      {divisions.map((division) => (
                        <option key={division.id} value={division.id}>
                          {division.name} • {getTierLabel(division.tier)}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={
                        !selectedTeam ||
                        !selectedDivisionId ||
                        savingTeam
                      }
                      onClick={() => void confirmTeam()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingTeam && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      Confirm Team
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border bg-card p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold">
                        Confirmed teams
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {confirmedTeams.length} team
                        {confirmedTeams.length === 1 ? "" : "s"} in this
                        league.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-6">
                    {divisions.map((division) => (
                      <div key={division.id}>
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold">
                                {division.name}
                              </h3>
                              <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase">
                                {getTierLabel(division.tier)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {teamsByDivision[division.id]?.length ?? 0}{" "}
                              teams
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          {(teamsByDivision[division.id] ?? []).map(
                            (team) => (
                              <TeamRow
                                key={team.id}
                                team={team}
                                manager={getManagerName(team)}
                                onRemove={() => void removeTeam(team)}
                              />
                            ),
                          )}
                          {(
                            teamsByDivision[division.id] ?? []
                          ).length === 0 && (
                            <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                              No teams confirmed in this division.
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {confirmedTeams.filter(
                      (team) => !team.division_id,
                    ).length > 0 && (
                      <div>
                        <h3 className="mb-3 font-bold">
                          Unassigned teams
                        </h3>
                        <div className="grid gap-2">
                          {confirmedTeams
                            .filter((team) => !team.division_id)
                            .map((team) => (
                              <TeamRow
                                key={team.id}
                                team={team}
                                manager={getManagerName(team)}
                                onRemove={() => void removeTeam(team)}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeSection === "divisions" && (
              <div className="space-y-6">
                <div className="rounded-2xl border bg-card p-6">
                  <h2 className="text-xl font-bold">Create division</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Create a new division for this league. NOVA supports
                    three division levels: Elite, Tier 2 and Tier 3.
                  </p>
                  <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
                    <input
                      value={newDivisionName}
                      onChange={(event) =>
                        setNewDivisionName(event.target.value)
                      }
                      placeholder="Division name"
                      className="rounded-xl border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      disabled={
                        !newDivisionName.trim() || creatingDivision
                      }
                      onClick={() => void createDivision()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {creatingDivision ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                      Create Division
                    </button>
                  </div>
                  <div className="mt-4 rounded-xl border border-dashed bg-background p-4">
                    <p className="text-xs leading-5 text-muted-foreground">
                      {canManageTiers
                        ? "As a NOVA Admin/Owner, you can assign or change a division's tier below."
                        : "Division tiers are controlled by NOVA Admins and the NOVA Owner. League Overseers and Co-Overseers cannot select or change them."}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border bg-card p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold">Divisions</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {divisions.length} division
                        {divisions.length === 1 ? "" : "s"} configured.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {TIER_OPTIONS.map((option) => (
                        <span
                          key={option.value}
                          className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                        >
                          {option.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {divisions.map((division) => {
                      const count =
                        teamsByDivision[division.id]?.length ?? 0;
                      return (
                        <div
                          key={division.id}
                          className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold">
                                {division.name}
                              </h3>
                              {!canManageTiers && (
                                <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase">
                                  {getTierLabel(division.tier)}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {count} team{count === 1 ? "" : "s"} •{" "}
                              {division.status ?? "draft"}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            {canManageTiers && (
                              <select
                                value={division.tier ?? 1}
                                onChange={(event) =>
                                  void updateDivisionTier(
                                    division,
                                    Number(event.target.value),
                                  )
                                }
                                disabled={saving}
                                className="rounded-lg border bg-background px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                              >
                                {TIER_OPTIONS.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => void deleteDivision(division)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {divisions.length === 0 && (
                      <div className="rounded-xl border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
                        No divisions have been created yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeSection === "settings" && (
              <div className="space-y-6">
                <SettingsCard
                  title="League settings"
                  description="Core rules used by this league."
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field
                      label="Maximum roster size"
                      type="number"
                      value={String(settings.max_roster_size ?? 20)}
                      onChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          max_roster_size: Number(value),
                        }))
                      }
                    />
                    <Field
                      label="Gameweek interval (days)"
                      type="number"
                      value={String(
                        settings.gameweek_interval_days ?? 3,
                      )}
                      onChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          gameweek_interval_days: Number(value),
                        }))
                      }
                    />
                  </div>
                  <SaveButton
                    saving={saving}
                    onClick={() => void saveLeagueSettings()}
                  />
                </SettingsCard>
                <SettingsCard
                  title="League information"
                  description="Information displayed around NOVA."
                >
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      League
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {league.name}
                    </p>
                    {league.description && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {league.description}
                      </p>
                    )}
                    {league.season && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Season: {league.season}
                      </p>
                    )}
                  </div>
                </SettingsCard>
              </div>
            )}
            {activeSection === "transfers" && (
              <div className="space-y-6">
                <SettingsCard
                  title="Transfer & budget rules"
                  description="Control the starting budget, roster limit and transfer window for this league."
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field
                      label="Starting transfer budget"
                      type="number"
                      value={String(
                        settings.default_transfer_budget ?? 0,
                      )}
                      onChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          default_transfer_budget: Number(value),
                        }))
                      }
                    />
                    <Field
                      label="Maximum roster size"
                      type="number"
                      value={String(settings.max_roster_size ?? 20)}
                      onChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          max_roster_size: Number(value),
                        }))
                      }
                    />
                    <Field
                      label="Transfer window start"
                      type="datetime-local"
                      value={toDateTimeLocal(
                        settings.transfer_window_start,
                      )}
                      onChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          transfer_window_start: value
                            ? new Date(value).toISOString()
                            : null,
                        }))
                      }
                    />
                    <Field
                      label="Transfer window end"
                      type="datetime-local"
                      value={toDateTimeLocal(
                        settings.transfer_window_end,
                      )}
                      onChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          transfer_window_end: value
                            ? new Date(value).toISOString()
                            : null,
                        }))
                      }
                    />
                  </div>
                  <SaveButton
                    saving={saving}
                    onClick={() => void saveLeagueSettings()}
                  />
                </SettingsCard>
                <div className="rounded-2xl border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl border">
                      <Wallet className="size-5" />
                    </div>
                    <div>
                      <h2 className="font-bold">Transfer rules</h2>
                      <p className="text-sm text-muted-foreground">
                        The underlying transfer, loan and release rules can
                        be enforced by NOVA's transfer system.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <RuleCard title="Loans" />
                    <RuleCard title="Releases" />
                    <RuleCard title="Transfer offers" />
                  </div>
                </div>
              </div>
            )}
            {activeSection === "discord" && (
              <div className="space-y-6">
                <SettingsCard
                  title="Discord staff roles"
                  description="Choose the Discord roles that NOVA will recognise as Manager and Co-Manager roles for this league."
                >
                  {!guildSettings?.guild_id ? (
                    <div className="rounded-xl border border-dashed bg-background p-5">
                      <p className="font-semibold">
                        No Discord server connected
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Run <strong>/setup</strong> in the Discord server for
                        this league first. Once the server is connected, you
                        can select the Manager and Co-Manager role IDs here.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border bg-background p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Connected Discord server
                        </p>
                        <p className="mt-1 font-semibold">
                          {guildSettings.guild_name || guildSettings.guild_id}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Guild ID: {guildSettings.guild_id}
                        </p>
                      </div>
                      <div className="mt-5 grid gap-5 md:grid-cols-2">
                        <div>
                          <label className="text-sm font-semibold">
                            Manager Role ID
                          </label>
                          <input
                            value={managerRoleId}
                            onChange={(event) =>
                              setManagerRoleId(event.target.value)
                            }
                            placeholder="e.g. 123456789012345678"
                            className="mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            Members with this Discord role can use NOVA
                            manager commands for their club.
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-semibold">
                            Co-Manager Role ID
                          </label>
                          <input
                            value={coManagerRoleId}
                            onChange={(event) =>
                              setCoManagerRoleId(event.target.value)
                            }
                            placeholder="e.g. 123456789012345678"
                            className="mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            Members with this Discord role receive the same
                            manager-level NOVA command access.
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 rounded-xl border border-dashed bg-background p-4">
                        <p className="text-sm font-semibold">
                          Used by the NOVA transfer system
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          These roles will control access to commands such as
                          /sign, /release, /transfer and /loan. The bot will
                          also verify that the manager or co-manager belongs
                          to the relevant club.
                        </p>
                      </div>
                      <button
                        onClick={() => void saveDiscordRoles()}
                        disabled={savingDiscordRoles}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {savingDiscordRoles ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        Save Staff Roles
                      </button>
                    </>
                  )}
                </SettingsCard>
                <SettingsCard
                  title="Discord channels"
                  description="Channel IDs are stored here so NOVA knows where league messages belong."
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    {channelInput(
                      "Fixtures Channel",
                      "fixtures_channel_id",
                    )}
                    {channelInput(
                      "Results Channel",
                      "results_channel_id",
                    )}
                    {channelInput(
                      "Table Channel",
                      "table_channel_id",
                    )}
                    {channelInput(
                      "Signings Channel",
                      "signings_channel_id",
                    )}
                    {channelInput(
                      "Releases Channel",
                      "releases_channel_id",
                    )}
                    {channelInput(
                      "Budgets Channel",
                      "budgets_channel_id",
                    )}
                    {channelInput(
                      "Transfers Channel",
                      "transfers_channel_id",
                    )}
                    {channelInput(
                      "Loans Channel",
                      "loans_channel_id",
                    )}
                    {channelInput(
                      "Transfer Window Channel",
                      "transfer_window_channel_id",
                    )}
                    {channelInput(
                      "Announcements Channel",
                      "announcements_channel_id",
                    )}
                  </div>
                  <div className="mt-5 rounded-xl border border-dashed bg-background p-4">
                    <p className="text-sm font-semibold">
                      Discord channel picker
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      These fields currently accept channel IDs. NOVA will
                      later replace these with dropdowns populated from the
                      connected Discord server.
                    </p>
                  </div>
                  <button
                    onClick={() => void saveChannels()}
                    disabled={saving}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {saving && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Save Discord Settings
                  </button>
                </SettingsCard>
                <div className="rounded-2xl border bg-card p-6">
                  <h2 className="text-lg font-bold">
                    Global announcements
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    The configured Announcements Channel receives NOVA-wide
                    announcements. Only NOVA Admin can actually send global
                    announcements.
                  </p>
                </div>
              </div>
            )}
            {activeSection === "overseers" && (
              <div className="space-y-6">
                <SettingsCard
                  title="League Overseers"
                  description="Manage the people responsible for operating this league."
                >
                  <div className="space-y-3">
                    {members.map((member) => {
                      const profile = member.user_id
                        ? profiles[member.user_id]
                        : undefined;
                      const name =
                        profile?.display_name ||
                        profile?.username ||
                        "Unknown user";
                      return (
                        <div
                          key={member.id ?? `${member.user_id}-${member.role}`}
                          className="flex items-center justify-between rounded-xl border p-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="grid size-10 place-items-center rounded-full border">
                              <Shield className="size-4" />
                            </div>
                            <div>
                              <p className="font-semibold">{name}</p>
                              <p className="text-xs text-muted-foreground">
                                {member.role === "overseer"
                                  ? "League Overseer"
                                  : "Co-Overseer"}
                              </p>
                            </div>
                          </div>
                          {member.role === "co_overseer" && (
                            <button
                              onClick={() =>
                                void removeCoOverseer(member)
                              }
                              className="rounded-lg border p-2 text-destructive transition hover:bg-destructive/10"
                              title="Remove Co-Overseer"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </SettingsCard>
                <SettingsCard
                  title="Appoint Co-Overseer"
                  description="Search for a NOVA user and give them operational access to this league."
                >
                  <div className="relative">
                    <input
                      value={newCoOverseer}
                      onChange={(event) =>
                        void searchMembers(event.target.value)
                      }
                      placeholder="Search username or display name..."
                      className="w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    {searchingMembers && (
                      <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
                    )}
                    {memberSearchResults.length > 0 && (
                      <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border bg-card p-1 shadow-xl">
                        {memberSearchResults.map((profile) => (
                          <button
                            key={profile.id}
                            onClick={() => void addCoOverseer(profile)}
                            className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition hover:bg-accent"
                          >
                            <div className="grid size-9 place-items-center rounded-full border">
                              <Users className="size-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">
                                {profile.display_name ||
                                  profile.username ||
                                  "User"}
                              </p>
                              {profile.username && (
                                <p className="text-xs text-muted-foreground">
                                  @{profile.username}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </SettingsCard>
                <div className="rounded-2xl border bg-card p-6">
                  <h2 className="text-lg font-bold">
                    Permission boundary
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    League Overseers and Co-Overseers only manage this
                    league. They do not receive NOVA-wide administrator
                    permissions.
                  </p>
                  <div className="mt-5 rounded-xl border bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Division tier authority
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Only NOVA Admins and the NOVA Owner can assign or change
                      division tiers. The available levels are Elite, Tier 2
                      and Tier 3.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="mt-4 text-3xl font-bold">{value}</p>
    </div>
  );
}
function QuickAction({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border p-4 text-left transition hover:bg-accent"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </button>
  );
}
function TeamRow({
  team,
  manager,
  onRemove,
}: {
  team: Team;
  manager: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {team.logo_url ? (
          <img
            src={team.logo_url}
            alt=""
            className="size-10 rounded-full object-contain"
          />
        ) : (
          <div className="grid size-10 place-items-center rounded-full border">
            <Users className="size-4" />
          </div>
        )}
        <div>
          <p className="font-semibold">{team.name}</p>
          <p className="text-xs text-muted-foreground">
            {manager}
          </p>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
      >
        <Trash2 className="size-4" />
        Remove
      </button>
    </div>
  );
}
function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
function SaveButton({
  saving,
  onClick,
}: {
  saving: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
    >
      {saving ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Check className="size-4" />
      )}
      Save Settings
    </button>
  );
}
function RuleCard({ title }: { title: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Managed by NOVA's league rules.
      </p>
    </div>
  );
}
function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}
