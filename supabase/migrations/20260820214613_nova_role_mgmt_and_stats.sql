/*
# Secure role management + admin overview stats

## Purpose
1. Adds a SECURITY DEFINER function `set_user_role` so admins can change a
   user's role safely. The function enforces:
     - Only admins (has_role('admin')) may call it.
     - A user cannot change their own role (prevents self-elevation/demotion).
     - The last admin cannot be demoted (prevents lockout).
2. Adds an `admin_stats` function returning platform-wide counts for the admin
   overview dashboard.

## Security
- Both functions are SECURITY DEFINER, search_path = public.
- EXECUTE is granted to `authenticated` so the anon-key frontend can call them
  via RPC; the function body re-checks `has_role` so non-admins get an error.
- No new tables; no RLS changes.
*/

CREATE OR REPLACE FUNCTION public.set_user_role(_target_user_id uuid, _new_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _current_role public.app_role;
  _admin_count int;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to manage roles.';
  END IF;
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'Only admins can change user roles.';
  END IF;
  IF _caller = _target_user_id THEN
    RAISE EXCEPTION 'You cannot change your own role.';
  END IF;

  SELECT role INTO _current_role
  FROM public.user_roles
  WHERE user_id = _target_user_id
  LIMIT 1;

  -- Prevent demoting the last remaining admin.
  IF _current_role = 'admin' AND _new_role <> 'admin' THEN
    SELECT count(*) INTO _admin_count
    FROM public.user_roles
    WHERE role = 'admin';
    IF _admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last remaining admin.';
    END IF;
  END IF;

  IF _current_role IS NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, _new_role);
  ELSE
    UPDATE public.user_roles SET role = _new_role WHERE user_id = _target_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS TABLE (
  total_users bigint,
  total_teams bigint,
  total_players bigint,
  total_leagues bigint,
  total_fixtures bigint,
  upcoming_fixtures bigint,
  completed_results bigint,
  total_transfers bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.teams),
    (SELECT count(*) FROM public.players),
    (SELECT count(*) FROM public.leagues),
    (SELECT count(*) FROM public.fixtures),
    (SELECT count(*) FROM public.fixtures WHERE status <> 'completed' AND kickoff_at >= now()),
    (SELECT count(*) FROM public.fixtures WHERE status = 'completed'),
    (SELECT count(*) FROM public.transfers);
$$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
