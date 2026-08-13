REVOKE EXECUTE ON FUNCTION public.recalculate_standings() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_player_stats() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_gameweek(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fixtures_standings_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;