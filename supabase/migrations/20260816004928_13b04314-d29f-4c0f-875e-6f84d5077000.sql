CREATE TABLE public.guild_settings (
  guild_id text PRIMARY KEY,
  guild_name text,
  manager_role_id text,
  co_manager_role_id text,
  player_role_id text,
  updated_by_discord_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.guild_settings TO service_role;

ALTER TABLE public.guild_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages guild settings"
ON public.guild_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER guild_settings_updated
BEFORE UPDATE ON public.guild_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();