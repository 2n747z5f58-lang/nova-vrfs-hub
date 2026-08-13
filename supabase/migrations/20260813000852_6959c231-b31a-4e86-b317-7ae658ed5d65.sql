-- roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'co_manager';

-- leagues / divisions
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.divisions ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE public.divisions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE public.divisions ADD COLUMN IF NOT EXISTS start_date timestamptz;
ALTER TABLE public.divisions ADD COLUMN IF NOT EXISTS gameweek_interval_days integer NOT NULL DEFAULT 3;
ALTER TABLE public.divisions ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS budget numeric NOT NULL DEFAULT 0;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS teams_name_league_uniq ON public.teams (lower(name), COALESCE(league_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- players
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS appearances integer NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS goals integer NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS assists integer NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS loan_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS players_discord_id_uniq ON public.players (discord_id) WHERE discord_id IS NOT NULL;

-- team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE CASCADE;
ALTER TABLE public.team_members ALTER COLUMN profile_id DROP NOT NULL;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS left_at timestamptz;

-- fixtures
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS gameweek integer;
CREATE UNIQUE INDEX IF NOT EXISTS fixtures_unique_pairing ON public.fixtures (division_id, gameweek, home_team_id, away_team_id) WHERE division_id IS NOT NULL AND gameweek IS NOT NULL;

-- results
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS replay_code text;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS completed_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS results_fixture_uniq ON public.results (fixture_id);

-- standings
ALTER TABLE public.standings ADD COLUMN IF NOT EXISTS goal_difference integer NOT NULL DEFAULT 0;

-- transfers
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- transfer_offers
CREATE TABLE IF NOT EXISTS public.transfer_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  from_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  to_team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  offered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  fee numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  discord_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  responded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
GRANT SELECT ON public.transfer_offers TO authenticated;
GRANT ALL ON public.transfer_offers TO service_role;
ALTER TABLE public.transfer_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read transfer offers" ON public.transfer_offers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "managers read own transfer offers" ON public.transfer_offers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id IN (transfer_offers.from_team_id, transfer_offers.to_team_id) AND t.manager_id = auth.uid()));
CREATE POLICY "staff manage transfer offers" ON public.transfer_offers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE UNIQUE INDEX IF NOT EXISTS transfer_offers_pending_uniq ON public.transfer_offers (player_id, to_team_id) WHERE status = 'pending';

-- loans
CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  parent_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  loan_team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  division_id uuid REFERENCES public.divisions(id) ON DELETE SET NULL,
  start_gameweek integer NOT NULL DEFAULT 1,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_gameweek integer,
  end_date timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loans TO anon;
GRANT SELECT ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read loans" ON public.loans FOR SELECT USING (true);
CREATE POLICY "staff manage loans" ON public.loans FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE UNIQUE INDEX IF NOT EXISTS loans_active_player_uniq ON public.loans (player_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.loan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  gameweek integer,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loan_events TO anon;
GRANT SELECT ON public.loan_events TO authenticated;
GRANT ALL ON public.loan_events TO service_role;
ALTER TABLE public.loan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read loan events" ON public.loan_events FOR SELECT USING (true);
CREATE POLICY "staff manage loan events" ON public.loan_events FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- signings
CREATE TABLE IF NOT EXISTS public.signings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  previous_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  season text,
  signed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.signings TO anon;
GRANT SELECT ON public.signings TO authenticated;
GRANT ALL ON public.signings TO service_role;
ALTER TABLE public.signings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read signings" ON public.signings FOR SELECT USING (true);
CREATE POLICY "staff manage signings" ON public.signings FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- releases
CREATE TABLE IF NOT EXISTS public.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  released_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.releases TO anon;
GRANT SELECT ON public.releases TO authenticated;
GRANT ALL ON public.releases TO service_role;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read releases" ON public.releases FOR SELECT USING (true);
CREATE POLICY "staff manage releases" ON public.releases FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- budget transactions
CREATE TABLE IF NOT EXISTS public.budget_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  amount numeric NOT NULL,
  related_transfer_id uuid REFERENCES public.transfers(id) ON DELETE SET NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.budget_transactions TO authenticated;
GRANT ALL ON public.budget_transactions TO service_role;
ALTER TABLE public.budget_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read budget transactions" ON public.budget_transactions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "managers read own budget transactions" ON public.budget_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = budget_transactions.team_id AND t.manager_id = auth.uid()));
CREATE POLICY "staff manage budget transactions" ON public.budget_transactions FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- team staff (manager / co-manager assignments)
CREATE TABLE IF NOT EXISTS public.team_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'manager',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id, role)
);
GRANT SELECT ON public.team_staff TO anon;
GRANT SELECT ON public.team_staff TO authenticated;
GRANT ALL ON public.team_staff TO service_role;
ALTER TABLE public.team_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read team staff" ON public.team_staff FOR SELECT USING (true);
CREATE POLICY "staff manage team staff" ON public.team_staff FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- gameweeks
CREATE TABLE IF NOT EXISTS public.gameweeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  number integer NOT NULL,
  starts_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (division_id, number)
);
GRANT SELECT ON public.gameweeks TO anon;
GRANT SELECT ON public.gameweeks TO authenticated;
GRANT ALL ON public.gameweeks TO service_role;
ALTER TABLE public.gameweeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read gameweeks" ON public.gameweeks FOR SELECT USING (true);
CREATE POLICY "staff manage gameweeks" ON public.gameweeks FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- current gameweek helper
CREATE OR REPLACE FUNCTION public.current_gameweek(_division_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(g.number), 0) FROM public.gameweeks g
  WHERE g.division_id = _division_id AND g.starts_at <= now()
$$;

-- standings recalculation incl. goal difference
CREATE OR REPLACE FUNCTION public.recalculate_standings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.standings;
  INSERT INTO public.standings (division_id, team_id, played, won, drawn, lost, goals_for, goals_against, goal_difference, points)
  SELECT d.division_id, d.team_id,
    count(*),
    count(*) FILTER (WHERE d.gf > d.ga),
    count(*) FILTER (WHERE d.gf = d.ga),
    count(*) FILTER (WHERE d.gf < d.ga),
    COALESCE(sum(d.gf),0), COALESCE(sum(d.ga),0),
    COALESCE(sum(d.gf),0) - COALESCE(sum(d.ga),0),
    count(*) FILTER (WHERE d.gf > d.ga) * 3 + count(*) FILTER (WHERE d.gf = d.ga)
  FROM (
    SELECT f.division_id, f.home_team_id AS team_id, f.home_score AS gf, f.away_score AS ga
    FROM public.fixtures f WHERE f.status = 'completed' AND f.division_id IS NOT NULL AND f.home_score IS NOT NULL
    UNION ALL
    SELECT f.division_id, f.away_team_id AS team_id, f.away_score AS gf, f.home_score AS ga
    FROM public.fixtures f WHERE f.status = 'completed' AND f.division_id IS NOT NULL AND f.away_score IS NOT NULL
  ) d
  WHERE d.team_id IS NOT NULL
  GROUP BY d.division_id, d.team_id;
END; $$;

-- player stat recalculation from match events + completed fixtures
CREATE OR REPLACE FUNCTION public.recalculate_player_stats()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.players p SET
    goals = COALESCE(s.goals, 0),
    assists = COALESCE(s.assists, 0),
    appearances = COALESCE(s.apps, 0)
  FROM (
    SELECT me.player_id,
      count(*) FILTER (WHERE me.event_type = 'goal') AS goals,
      count(*) FILTER (WHERE me.event_type = 'assist') AS assists,
      count(DISTINCT me.fixture_id) AS apps
    FROM public.match_events me
    JOIN public.fixtures f ON f.id = me.fixture_id AND f.status = 'completed'
    WHERE me.player_id IS NOT NULL
    GROUP BY me.player_id
  ) s
  WHERE p.id = s.player_id;
END; $$;
