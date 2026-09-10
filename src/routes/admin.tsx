import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Shield,
  Loader2,
  LayoutDashboard,
  Trophy,
  Users,
  Settings,
  ChevronDown,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: Admin,
});

type LeagueTier = "unranked" | "elite" | "tier_2" | "tier_3";

type League = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  season: string | null;
  status: string | null;
  ranking_tier: LeagueTier;
};

const TIER_LABELS: Record<LeagueTier, string> = {
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
  const [activeSection, setActiveSection] = useState("overview");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [savingLeague, setSavingLeague] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        void navigate({ to: "/auth" });
        return;
      }

      const role =
        user.app_metadata?.role ??
        user.user_metadata?.role;

      const username =
        user.user_metadata?.username ??
        user.user_metadata?.display_name ??
        "";

      const adminAccess = role === "admin";
      const ownerAccess =
        username.toLowerCase() === "aa23fr";

      if (adminAccess || ownerAccess) {
        setAllowed(true);
      }

      setIsOwner(ownerAccess);
      setChecking(false);
    }

    void checkAdmin();
  }, [navigate]);

  useEffect(() => {
    if (activeSection !== "leagues" || !allowed) {
      return;
    }

    async function loadLeagues() {
      setLoadingLeagues(true);

      const { data, error } = await supabase
        .from("leagues")
        .select(
          "id, name, slug, logo_url, description, season, status, ranking_tier",
        )
        .order("name", { ascending: true });

      if (error) {
        console.error("Failed to load leagues:", error);
        setLeagues([]);
      } else {
        setLeagues(
          (data ?? []).map((league) => ({
            ...league,
            ranking_tier:
              league.ranking_tier ?? "unranked",
          })),
        );
      }

      setLoadingLeagues(false);
    }

    void loadLeagues();
  }, [activeSection, allowed]);

  async function updateLeagueTier(
    leagueId: string,
    tier: LeagueTier,
  ) {
    if (!isOwner) {
      return;
    }

    setSavingLeague(leagueId);

    const { error } = await supabase
      .from("leagues")
      .update({
        ranking_tier: tier,
      })
      .eq("id", leagueId);

    if (error) {
      console.error(
        "Failed to update league tier:",
        error,
      );
    } else {
      setLeagues((current) =>
        current.map((league) =>
          league.id === leagueId
            ? {
                ...league,
                ranking_tier: tier,
              }
            : league,
        ),
      );
    }

    setSavingLeague(null);
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
            Your account doesn't have administrator permissions.
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
              active={activeSection === "overview"}
              icon={<LayoutDashboard className="size-4" />}
              label="Overview"
              onClick={() =>
                setActiveSection("overview")
              }
            />

            <NavButton
              active={activeSection === "leagues"}
              icon={<Trophy className="size-4" />}
              label="Leagues"
              onClick={() =>
                setActiveSection("leagues")
              }
            />

            <NavButton
              active={activeSection === "users"}
              icon={<Users className="size-4" />}
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
                  {activeSection === "overview" &&
                    "Overview"}

                  {activeSection === "leagues" &&
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
                active={activeSection === "overview"}
                label="Overview"
                onClick={() =>
                  setActiveSection("overview")
                }
              />

              <MobileNavButton
                active={activeSection === "leagues"}
                label="Leagues"
                onClick={() =>
                  setActiveSection("leagues")
                }
              />

              <MobileNavButton
                active={activeSection === "users"}
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
              {activeSection === "overview" && (
                <Overview
                  isOwner={isOwner}
                  onLeagues={() =>
                    setActiveSection("leagues")
                  }
                />
              )}

              {activeSection === "leagues" && (
                <Leagues
                  leagues={leagues}
                  loading={loadingLeagues}
                  savingLeague={savingLeague}
                  isOwner={isOwner}
                  onTierChange={updateLeagueTier}
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
                  />
                )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Overview({
  isOwner,
  onLeagues,
}: {
  isOwner: boolean;
  onLeagues: () => void;
}) {
  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        <StatCard
          title="Access"
          value={isOwner ? "Owner" : "Admin"}
          description="Current NOVA permissions"
          icon={<Shield className="size-5" />}
        />

        <StatCard
          title="League Management"
          value="Ready"
          description="League controls available"
          icon={<Trophy className="size-5" />}
        />

        <StatCard
          title="System"
          value="NOVA"
          description="VRFS league platform"
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
          League control centre
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage NOVA leagues and their platform-wide
          classification from one place.
        </p>

        <button
          type="button"
          onClick={onLeagues}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Trophy className="size-4" />
          Manage leagues
        </button>

        {isOwner && (
          <div className="mt-6 rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold">
              Owner controls enabled
            </p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Owner-only settings are hidden from normal
              administrators.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Leagues({
  leagues,
  loading,
  savingLeague,
  isOwner,
  onTierChange,
}: {
  leagues: League[];
  loading: boolean;
  savingLeague: string | null;
  isOwner: boolean;
  onTierChange: (
    leagueId: string,
    tier: LeagueTier,
  ) => void;
}) {
  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          All leagues currently registered with NOVA.
        </p>
      </div>

      {leagues.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Trophy className="mx-auto size-8 text-muted-foreground" />

          <h2 className="mt-4 font-semibold">
            No leagues found
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Leagues will appear here once they are created.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {leagues.map((league) => (
            <LeagueCard
              key={league.id}
              league={league}
              saving={
                savingLeague === league.id
              }
              isOwner={isOwner}
              onTierChange={onTierChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LeagueCard({
  league,
  saving,
  isOwner,
  onTierChange,
}: {
  league: League;
  saving: boolean;
  isOwner: boolean;
  onTierChange: (
    leagueId: string,
    tier: LeagueTier,
  ) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
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

          <div className="min-w-0">
            <h2 className="truncate font-semibold">
              {league.name}
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              {league.status ?? "Unknown"}{" "}
              {league.season
                ? `• ${league.season}`
                : ""}
            </p>
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            disabled={!isOwner || saving}
            onClick={() => setOpen(!open)}
            className="flex min-w-[160px] items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>
              {saving
                ? "Saving..."
                : TIER_LABELS[
                    league.ranking_tier
                  ]}
            </span>

            <ChevronDown className="size-4 text-muted-foreground" />
          </button>

          {open && isOwner && !saving && (
            <div className="absolute right-0 z-20 mt-2 w-full min-w-[180px] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-xl">
              {(
                [
                  "unranked",
                  "elite",
                  "tier_2",
                  "tier_3",
                ] as LeagueTier[]
              ).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onTierChange(
                      league.id,
                      tier,
                    );
                  }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span>
                    {TIER_LABELS[tier]}
                  </span>

                  {league.ranking_tier ===
                    tier && (
                    <Check className="size-4" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {league.description && (
        <p className="mt-4 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
          {league.description}
        </p>
      )}

      {!isOwner && (
        <p className="mt-4 text-xs text-muted-foreground">
          League classification is controlled by the NOVA
          owner.
        </p>
      )}
    </div>
  );
}

function OwnerSettings({
  leagues,
}: {
  leagues: League[];
}) {
  const counts = {
    elite: leagues.filter(
      (league) =>
        league.ranking_tier === "elite",
    ).length,
    tier2: leagues.filter(
      (league) =>
        league.ranking_tier === "tier_2",
    ).length,
    tier3: leagues.filter(
      (league) =>
        league.ranking_tier === "tier_3",
    ).length,
    unranked: leagues.filter(
      (league) =>
        league.ranking_tier === "unranked",
    ).length,
  };

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
              NOVA league classification
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Platform-wide league tiers are controlled
              here. New leagues are Unranked by default.
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
        league{value === 1 ? "" : "s"}
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
