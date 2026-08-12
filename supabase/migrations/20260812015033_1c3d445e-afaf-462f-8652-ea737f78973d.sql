
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','overseer','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','overseer'))
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  discord_username text,
  discord_id text,
  preferences jsonb NOT NULL DEFAULT '{"notify_fixtures":true,"notify_goals":true,"notify_transfers":true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, discord_username, discord_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_name', NEW.raw_user_meta_data->>'preferred_username', split_part(COALESCE(NEW.email,'player'),'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'provider_id'
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- LEAGUES / DIVISIONS / TEAMS
CREATE TABLE public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  description text,
  season text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name text NOT NULL,
  tier int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  league_id uuid REFERENCES public.leagues(id) ON DELETE SET NULL,
  division_id uuid REFERENCES public.divisions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  display_name text,
  avatar_url text,
  discord_username text,
  discord_id text,
  position text,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'player',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, profile_id)
);

CREATE TABLE public.fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE,
  division_id uuid REFERENCES public.divisions(id) ON DELETE SET NULL,
  home_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  away_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  kickoff_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  home_score int,
  away_score int,
  competition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER fixtures_updated BEFORE UPDATE ON public.fixtures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX fixtures_kickoff_idx ON public.fixtures (kickoff_at);

CREATE TABLE public.results (
  fixture_id uuid PRIMARY KEY REFERENCES public.fixtures(id) ON DELETE CASCADE,
  home_score int NOT NULL DEFAULT 0,
  away_score int NOT NULL DEFAULT 0,
  notes text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id uuid NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'goal',
  minute int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  from_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  to_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  transfer_date date NOT NULL DEFAULT current_date,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  played int NOT NULL DEFAULT 0,
  won int NOT NULL DEFAULT 0,
  drawn int NOT NULL DEFAULT 0,
  lost int NOT NULL DEFAULT 0,
  goals_for int NOT NULL DEFAULT 0,
  goals_against int NOT NULL DEFAULT 0,
  points int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (division_id, team_id)
);

-- public read + admin write for competition tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leagues','divisions','teams','players','staff','team_members','fixtures','results','match_events','transfers','standings']
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "public read %1$s" ON public.%1$I FOR SELECT USING (true);', t);
    EXECUTE format('CREATE POLICY "staff manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));', t);
  END LOOP;
END $$;

-- FAVOURITES
CREATE TABLE public.favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favourites TO authenticated;
GRANT ALL ON public.favourites TO service_role;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favourites" ON public.favourites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  related_type text,
  related_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX notifications_user_idx ON public.notifications (user_id, read, created_at DESC);

-- STANDINGS RECALC
CREATE OR REPLACE FUNCTION public.recalculate_standings() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.standings;
  INSERT INTO public.standings (division_id, team_id, played, won, drawn, lost, goals_for, goals_against, points)
  SELECT d.division_id, d.team_id,
    count(*) AS played,
    count(*) FILTER (WHERE d.gf > d.ga) AS won,
    count(*) FILTER (WHERE d.gf = d.ga) AS drawn,
    count(*) FILTER (WHERE d.gf < d.ga) AS lost,
    COALESCE(sum(d.gf),0), COALESCE(sum(d.ga),0),
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

CREATE OR REPLACE FUNCTION public.fixtures_standings_trigger() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.recalculate_standings(); RETURN NULL; END; $$;
CREATE TRIGGER fixtures_recalc AFTER INSERT OR UPDATE OR DELETE ON public.fixtures FOR EACH STATEMENT EXECUTE FUNCTION public.fixtures_standings_trigger();

-- SEED DATA
INSERT INTO public.leagues (id, name, slug, description, season) VALUES
 ('11111111-1111-1111-1111-111111111111','NOVA Premier League','nova-premier','The flagship NOVA VRFS competition featuring the strongest sides on the platform.','Season 1'),
 ('22222222-2222-2222-2222-222222222222','NOVA Championship','nova-championship','Second-tier NOVA VRFS competition with promotion into the Premier League.','Season 1'),
 ('33333333-3333-3333-3333-333333333333','NOVA Cup','nova-cup','Knockout VRFS cup competition open to all NOVA clubs.','Season 1');

INSERT INTO public.divisions (id, league_id, name, tier) VALUES
 ('aaaaaaa1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Division 1',1),
 ('aaaaaaa1-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Division 2',2),
 ('aaaaaaa1-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','Championship Division',1);

INSERT INTO public.teams (id, name, slug, league_id, division_id) VALUES
 ('bbbbbbb1-0000-0000-0000-000000000001','Apex Vanguard','apex-vanguard','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001'),
 ('bbbbbbb1-0000-0000-0000-000000000002','Nova Athletic','nova-athletic','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001'),
 ('bbbbbbb1-0000-0000-0000-000000000003','Orbit United','orbit-united','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001'),
 ('bbbbbbb1-0000-0000-0000-000000000004','Titan Rovers','titan-rovers','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001'),
 ('bbbbbbb1-0000-0000-0000-000000000005','Solaris FC','solaris-fc','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000002'),
 ('bbbbbbb1-0000-0000-0000-000000000006','Pulse City','pulse-city','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000002'),
 ('bbbbbbb1-0000-0000-0000-000000000007','Vertex Wanderers','vertex-wanderers','22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-0000-0000-000000000003'),
 ('bbbbbbb1-0000-0000-0000-000000000008','Zenith Sporting','zenith-sporting','22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-0000-0000-000000000003');

INSERT INTO public.players (id, username, display_name, position, team_id, discord_username) VALUES
 ('ccccccc1-0000-0000-0000-000000000001','xVoltage','Kai Mercer','Striker','bbbbbbb1-0000-0000-0000-000000000001','xvoltage'),
 ('ccccccc1-0000-0000-0000-000000000002','Riftz','Dan Okoye','Midfielder','bbbbbbb1-0000-0000-0000-000000000001','riftz'),
 ('ccccccc1-0000-0000-0000-000000000003','NovaKid','Leo Fisher','Goalkeeper','bbbbbbb1-0000-0000-0000-000000000002','novakid'),
 ('ccccccc1-0000-0000-0000-000000000004','Sable','Marc Ruiz','Defender','bbbbbbb1-0000-0000-0000-000000000002','sable'),
 ('ccccccc1-0000-0000-0000-000000000005','Ghostt','Ade Bello','Striker','bbbbbbb1-0000-0000-0000-000000000003','ghostt'),
 ('ccccccc1-0000-0000-0000-000000000006','Kite','Tom Vale','Winger','bbbbbbb1-0000-0000-0000-000000000004','kite'),
 ('ccccccc1-0000-0000-0000-000000000007','Zeph','Nico Adler','Midfielder','bbbbbbb1-0000-0000-0000-000000000005','zeph'),
 ('ccccccc1-0000-0000-0000-000000000008','Halo','Sam Grey','Defender','bbbbbbb1-0000-0000-0000-000000000007','halo');

INSERT INTO public.staff (team_id, name, role) VALUES
 ('bbbbbbb1-0000-0000-0000-000000000001','J. Hartley','Manager'),
 ('bbbbbbb1-0000-0000-0000-000000000002','R. Sanchez','Manager');

INSERT INTO public.fixtures (league_id, division_id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score, competition) VALUES
 ('11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000002', now() - interval '6 days', 'completed', 3, 1, 'NOVA Premier League'),
 ('11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000003','bbbbbbb1-0000-0000-0000-000000000004', now() - interval '5 days', 'completed', 2, 2, 'NOVA Premier League'),
 ('11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000002','bbbbbbb1-0000-0000-0000-000000000003', now() - interval '2 days', 'completed', 0, 1, 'NOVA Premier League'),
 ('11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000004','bbbbbbb1-0000-0000-0000-000000000001', now() - interval '1 day', 'completed', 1, 4, 'NOVA Premier League'),
 ('11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000003', now() + interval '4 hours', 'scheduled', NULL, NULL, 'NOVA Premier League'),
 ('11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000002','bbbbbbb1-0000-0000-0000-000000000004', now() + interval '1 day', 'scheduled', NULL, NULL, 'NOVA Premier League'),
 ('11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000002','bbbbbbb1-0000-0000-0000-000000000005','bbbbbbb1-0000-0000-0000-000000000006', now() + interval '2 days', 'scheduled', NULL, NULL, 'NOVA Premier League'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-0000-0000-000000000003','bbbbbbb1-0000-0000-0000-000000000007','bbbbbbb1-0000-0000-0000-000000000008', now() + interval '5 days', 'scheduled', NULL, NULL, 'NOVA Championship'),
 ('33333333-3333-3333-3333-333333333333',NULL,'bbbbbbb1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000007', now() + interval '9 days', 'scheduled', NULL, NULL, 'NOVA Cup');

INSERT INTO public.results (fixture_id, home_score, away_score)
SELECT id, home_score, away_score FROM public.fixtures WHERE status = 'completed';

INSERT INTO public.match_events (fixture_id, player_id, team_id, event_type, minute)
SELECT f.id, 'ccccccc1-0000-0000-0000-000000000001', 'bbbbbbb1-0000-0000-0000-000000000001', 'goal', 23
FROM public.fixtures f WHERE f.status='completed' LIMIT 1;

INSERT INTO public.transfers (player_id, from_team_id, to_team_id, details)
VALUES ('ccccccc1-0000-0000-0000-000000000006','bbbbbbb1-0000-0000-0000-000000000005','bbbbbbb1-0000-0000-0000-000000000004','Permanent transfer ahead of Season 1.');

SELECT public.recalculate_standings();
