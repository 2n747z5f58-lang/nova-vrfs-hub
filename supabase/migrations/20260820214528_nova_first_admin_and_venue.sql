/*
# First-user admin assignment + fixture venue column

## Purpose
1. Implements the spec's "first user gets admin, everyone else gets normal" rule
   safely at the database level so simultaneous signups cannot create multiple admins.
2. Adds an optional `venue` column to fixtures for match-detail pages.

## Changes
- `public.fixtures`: adds `venue text` (nullable) for match locations.
- Replaces `public.handle_new_user()` trigger function so it atomically assigns
  the `admin` role to the very first user and `user` to everyone after.
- Uses `pg_advisory_xact_lock` to serialize the first-admin check, guaranteeing
  that two concurrent signups cannot both see "no roles exist" and both become admin.

## Security
- The trigger function remains SECURITY DEFINER so it can write to user_roles.
- No RLS policy changes — existing policies already allow admins to manage roles.
- The advisory lock key is a stable hash of 'nova_first_admin'.
*/

ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS venue text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Serialize the first-admin decision so concurrent signups are safe.
  PERFORM pg_advisory_xact_lock(hashtext('nova_first_admin'));

  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
