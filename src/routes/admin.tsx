import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Loader2,
  LayoutDashboard,
  Trophy,
  Users,
  Settings,
  ChevronDown,
  Check,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: Admin,
});

type PointsTier =
  | "unranked"
  | "elite"
  | "tier_2"
  | "tier_3";

type League = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  season: string | null;
  status: string | null;
};

type Division = {
  id: string;
  league_id: string;
  name: string;
  tier: number;
  season: string | null;
  status: string | null;
  points_tier: PointsTier;
};

const POINTS_TIER_LABELS: Record<
  PointsTier,
  string
> = {
  unranked: "Unranked",
  elite: "Elite",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
};

function Admin() {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const [activeSection, setActiveSection] =
    useState("overview");

  const [leagues, setLeagues] = useState<League[]>([]);
  const [divisions, setDivisions] = useState<Division[]>(
    [],
  );

  const [loadingLeagues, setLoadingLeagues] =
    useState(false);

  const [savingDivision, setSavingDivision] =
    useState<string | null>(null);

  useEffect(() => {
    async function checkAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        void navigate({ to: "/auth" });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "username, display_name, discord_username, discord_id",
        )
        .eq("id", user.id)
        .maybeSingle();

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAdminRole =
        roles?.some(
          (role) => role.role === "admin",
        ) ?? false;

      const ownerValues = [
        profile?.username,
        profile?.display_name,
        profile?.discord_username,
        profile?.discord_id,
        user.user_metadata?.username,
        user.user_metadata?.discord_username,
      ]
        .filter(Boolean)
        .map((value) =>
          String(value).toLowerCase(),
        );

      const ownerAccess =
        ownerValues.includes("aa23fr");

      setIsOwner(ownerAccess);
      setAllowed(
        hasAdminRole || ownerAccess,
      );
      setChecking(false);
    }

    void checkAccess();
  }, [navigate]);

  useEffect(() => {
    if (!allowed) {
      return;
    }

    void loadData();
  }, [allowed]);

  async function loadData() {
    setLoadingLeagues(true);

    const [
      { data: leagueData, error: leagueError },
      { data: divisionData, error: divisionError },
    ] = await Promise.all([
      supabase
        .from("leagues")
        .select(
          "id, name, slug, logo_url, description, season, status",
        )
        .order("name", {
          ascending: true,
        }),

      supabase
        .from("divisions")
        .select(
          "id, league_id, name, tier, season, status, points_tier",
        )
        .order("tier", {
          ascending: true,
        }),
    ]);

    if (leagueError) {
      console.error(
        "Failed to load leagues:",
        leagueError,
      );
    }

    if (divisionError) {
      console.error(
        "Failed to load divisions:",
        divisionError,
      );
    }

    setLeagues(leagueData ?? []);

    setDivisions(
      (divisionData ?? []).map(
        (division) => ({
          ...division,
          points_tier:
            division.points_tier ??
            "unranked",
        }),
      ),
    );

    setLoadingLeagues(false);
  }

  async function updateDivisionPointsTier(
    divisionId: string,
    pointsTier: PointsTier,
  ) {
    if (!isOwner) {
      return;
    }

    setSavingDivision(divisionId);

    const { error } = await supabase
      .from("divisions")
      .update({
        points_tier: pointsTier,
      })
      .eq("id", divisionId);

    if (error) {
      console.error(
        "Failed to update division points tier:",
        error,
      );

      setSavingDivision(null);
      return;
    }

    setDivisions((current) =>
      current.map((division) =>
        division.id === divisionId
          ? {
              ...division,
              points_tier: pointsTier,
            }
          : division,
      ),
    );

    setSavingDivision(null);
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin" />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="max-w-md text-center">
          <Shield className="mx-auto mb-5 size-10 text-muted-foreground" />

          <h1 className="text-2xl font-bold">
            Admin access required
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your account doesn't have administrator
            permissions.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
          <div className="border-b border-border px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="size-5" />
              </div>

              <div>
                <p className="text-sm font-bold">
                  NOVA
                </p>

                <p className="text-xs text-muted-foreground">
                  Control Panel
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            <NavButton
              active={
                activeSection === "overview"
              }
              icon={
                <LayoutDashboard className="size-4" />
              }
              label="Overview"
              onClick={() =>
                setActiveSection("overview")
              }
            />

            <NavButton
              active={
                activeSection === "leagues"
              }
              icon={
                <Trophy className="size-4" />
              }
              label="Leagues"
              onClick={() =>
                setActiveSection("leagues")
              }
            />

            <NavButton
              active={
                activeSection === "users"
              }
              icon={
                <Users className="size-4" />
              }
              label="Users & Roles"
              onClick={() =>
                setActiveSection("users")
              }
            />

            {isOwner && (
              <div className="pt-5">
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Owner
                </p>

                <NavButton
                  active={
                    activeSection === "owner"
                  }
                  icon={
                    <Settings className="size-4" />
                  }
                  label="Owner Settings"
                  onClick={() =>
                    setActiveSection("owner")
                  }
                />
              </div>
            )}
          </nav>

          <div className="border-t border-border p-4">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-semibold">
                NOVA Administration
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {isOwner
                  ? "Owner access"
                  : "Administrator access"}
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-border bg-background px-5 py-5 lg:px-10">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  NOVA / Operations
                </p>

                <h1 className="mt-2 text-3xl font-bold tracking-tight">
                  {activeSection ===
                    "overview" &&
                    "Overview"}

                  {activeSection ===
                    "leagues" &&
                    "Leagues"}

                  {activeSection === "users" &&
                    "Users & Roles"}

                  {activeSection === "owner" &&
                    "Owner Settings"}
                </h1>
              </div>

              {isOwner && (
                <div className="hidden rounded-full border border-border px-3 py-1.5 text-xs font-semibold sm:block">
                  OWNER
                </div>
              )}
            </div>
          </header>

          <div className="border-b border-border px-5 lg:hidden">
            <div className="flex gap-1 overflow-x-auto py-3">
              <MobileNavButton
                active={
                  activeSection === "overview"
                }
                label="Overview"
                onClick={() =>
                  setActiveSection("overview")
                }
              />

              <MobileNavButton
                active={
                  activeSection === "leagues"
                }
                label="Leagues"
                onClick={() =>
                  setActiveSection("leagues")
                }
              />

              <MobileNavButton
                active={
                  activeSection === "users"
                }
                label="Users"
                onClick={() =>
                  setActiveSection("users")
                }
              />

              {isOwner && (
                <MobileNavButton
                  active={
                    activeSection === "owner"
                  }
                  label="Owner"
                  onClick={() =>
                    setActiveSection("owner")
                  }
                />
              )}
            </div>
          </div>

          <section className="flex-1 px-5 py-8 lg:px-10">
            <div className="mx-auto max-w-[1440px]">
              {activeSection ===
                "overview" && (
                <Overview
                  isOwner={isOwner}
                  leagueCount={
                    leagues.length
                  }
                  divisionCount={
                    divisions.length
                  }
                  onLeagues={() =>
                    setActiveSection(
                      "leagues",
                    )
                  }
                />
              )}

              {activeSection ===
                "leagues" && (
                <LeagueManagement
                  leagues={leagues}
                  divisions={divisions}
                  loading={loadingLeagues}
                  savingDivision={
                    savingDivision
                  }
                  isOwner={isOwner}
                  onTierChange={
                    updateDivisionPointsTier
                  }
                />
              )}

              {activeSection === "users" && (
                <Placeholder
                  title="Users & Roles"
                  description="Manage NOVA accounts, roles and staff permissions."
                />
              )}

              {activeSection === "owner" &&
                isOwner && (
                  <OwnerSettings
                    leagues={leagues}
                    divisions={divisions}
                    isOwner={isOwner}
                    savingDivision={
                      savingDivision
                    }
                    onTierChange={
                      updateDivisionPointsTier
                    }
                  />
                )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function LeagueManagement({
  leagues,
  divisions,
  loading,
  savingDivision,
  isOwner,
  onTierChange,
}: {
  leagues: League[];
  divisions: Division[];
  loading: boolean;
  savingDivision: string | null;
  isOwner: boolean;
  onTierChange: (
    divisionId: string,
    tier: PointsTier,
  ) => void;
}) {
  const [openLeague, setOpenLeague] =
    useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">
          Select a league to view its divisions and
          configure division scoring tiers.
        </p>
      </div>

      <div className="space-y-4">
        {leagues.map((league) => {
          const leagueDivisions =
            divisions.filter(
              (division) =>
                division.league_id ===
                league.id,
            );

          const isOpen =
            openLeague === league.id;

          return (
            <div
              key={league.id}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenLeague(
                    isOpen
                      ? null
                      : league.id,
                  )
                }
                className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-muted/40"
              >
                <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background">
                  {league.logo_url ? (
                    <img
                      src={league.logo_url}
                      alt=""
                      className="size-full object-contain"
                    />
                  ) : (
                    <Trophy className="size-5 text-muted-foreground" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">
                    {league.name}
                  </h2>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {leagueDivisions.length}{" "}
                    division
                    {leagueDivisions.length ===
                    1
                      ? ""
                      : "s"}
                    {league.status
                      ? ` • ${league.status}`
                      : ""}
                  </p>
                </div>

                <ChevronDown
                  className={`size-5 shrink-0 text-muted-foreground transition-transform ${
                    isOpen
                      ? "rotate-180"
                      : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-border p-5">
                  {leagueDivisions.length ===
                  0 ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        This league has no divisions.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leagueDivisions.map(
                        (division) => (
                          <DivisionRow
                            key={
                              division.id
                            }
                            division={
                              division
                            }
                            saving={
                              savingDivision ===
                              division.id
                            }
                            isOwner={
                              isOwner
                            }
                            onTierChange={
                              onTierChange
                            }
                          />
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DivisionRow({
  division,
  saving,
  isOwner,
  onTierChange,
}: {
  division: Division;
  saving: boolean;
  isOwner: boolean;
  onTierChange: (
    divisionId: string,
    tier: PointsTier,
  ) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-xs font-bold">
              {division.tier}
            </span>

            <div className="min-w-0">
              <h3 className="truncate font-semibold">
                {division.name}
              </h3>

              <p className="mt-0.5 text-xs text-muted-foreground">
                Division Tier{" "}
                {division.tier}
                {division.status
                  ? ` • ${division.status}`
                  : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            disabled={!isOwner || saving}
            onClick={() =>
              setOpen(!open)
            }
            className="flex min-w-[170px] items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>
              {saving
                ? "Saving..."
                : POINTS_TIER_LABELS[
                    division.points_tier
                  ]}
            </span>

            {isOwner ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <Lock className="size-4 text-muted-foreground" />
            )}
          </button>

          {open && isOwner && !saving && (
            <div className="absolute right-0 z-30 mt-2 w-full min-w-[190px] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-xl">
              {(
                [
                  "unranked",
                  "elite",
                  "tier_2",
                  "tier_3",
                ] as PointsTier[]
              ).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    setOpen(false);

                    onTierChange(
                      division.id,
                      tier,
                    );
                  }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span>
                    {
                      POINTS_TIER_LABELS[
                        tier
                      ]
                    }
                  </span>

                  {division.points_tier ===
                    tier && (
                    <Check className="size-4" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          Points tier:{" "}
          <span className="font-semibold text-foreground">
            {
              POINTS_TIER_LABELS[
                division.points_tier
              ]
            }
          </span>
        </p>

        {!isOwner && (
          <p className="mt-1 text-xs text-muted-foreground">
            Only the NOVA owner can change scoring tiers.
          </p>
        )}
      </div>
    </div>
  );
}

function OwnerSettings({
  leagues,
  divisions,
  isOwner,
  savingDivision,
  onTierChange,
}: {
  leagues: League[];
  divisions: Division[];
  isOwner: boolean;
  savingDivision: string | null;
  onTierChange: (
    divisionId: string,
    tier: PointsTier,
  ) => void;
}) {
  const counts = useMemo(() => {
    return {
      elite: divisions.filter(
        (division) =>
          division.points_tier ===
          "elite",
      ).length,

      tier2: divisions.filter(
        (division) =>
          division.points_tier ===
          "tier_2",
      ).length,

      tier3: divisions.filter(
        (division) =>
          division.points_tier ===
          "tier_3",
      ).length,

      unranked: divisions.filter(
        (division) =>
          division.points_tier ===
          "unranked",
      ).length,
    };
  }, [divisions]);

  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Settings className="size-5" />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Owner only
            </p>

            <h2 className="mt-1 text-xl font-bold">
              Division scoring tiers
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Each division can use a different NOVA scoring
              tier. The selected tier will determine how
              player actions such as goals, assists, clean
              sheets and other statistics are scored.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TierSummary
          label="Elite"
          value={counts.elite}
        />

        <TierSummary
          label="Tier 2"
          value={counts.tier2}
        />

        <TierSummary
          label="Tier 3"
          value={counts.tier3}
        />

        <TierSummary
          label="Unranked"
          value={counts.unranked}
        />
      </div>

      <div className="mt-8">
        <LeagueManagement
          leagues={leagues}
          divisions={divisions}
          loading={false}
          savingDivision={savingDivision}
          isOwner={isOwner}
          onTierChange={onTierChange}
        />
      </div>
    </div>
  );
}

function Overview({
  isOwner,
  leagueCount,
  divisionCount,
  onLeagues,
}: {
  isOwner: boolean;
  leagueCount: number;
  divisionCount: number;
  onLeagues: () => void;
}) {
  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        <StatCard
          title="Access"
          value={
            isOwner ? "Owner" : "Admin"
          }
          description="Current NOVA permissions"
          icon={
            <Shield className="size-5" />
          }
        />

        <StatCard
          title="Leagues"
          value={String(leagueCount)}
          description="Registered NOVA leagues"
          icon={
            <Trophy className="size-5" />
          }
        />

        <StatCard
          title="Divisions"
          value={String(
            divisionCount,
          )}
          description="Across all leagues"
          icon={
            <LayoutDashboard className="size-5" />
          }
        />
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Administration
        </p>

        <h2 className="mt-2 text-xl font-bold">
          Division scoring control
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Every league can contain multiple divisions,
          and each division can have its own NOVA scoring
          tier.
        </p>

        <button
          type="button"
          onClick={onLeagues}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Trophy className="size-4" />
          Manage divisions
        </button>

        {isOwner && (
          <div className="mt-6 rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold">
              Owner controls enabled
            </p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              You can assign scoring tiers to individual
              divisions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TierSummary({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold">
        {value}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        division{value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {title}
        </p>

        <div className="text-muted-foreground">
          {icon}
        </div>
      </div>

      <p className="mt-4 text-2xl font-bold">
        {value}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-10">
      <h2 className="text-xl font-bold">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          This section will be built next.
        </p>
      </div>
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}
