REVOKE ALL ON FUNCTION public.current_gameweek(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_player_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_standings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_gameweek(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_player_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_standings() TO service_role;