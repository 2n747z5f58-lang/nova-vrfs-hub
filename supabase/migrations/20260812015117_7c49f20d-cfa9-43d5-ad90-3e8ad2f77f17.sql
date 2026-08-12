
REVOKE ALL ON FUNCTION public.recalculate_standings() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.fixtures_standings_trigger() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM anon, public;
