# Base44 Dev Environment

## What this is
NOVA League Platform — a TanStack Start (SSR) + Vite + React 19 + TypeScript app.
Package manager: bun is configured (`bunfig.toml`), but the Base44 compose uses
`npm` (Node 22 image) which works fine and ignores `bunfig.toml`.

## Running it
`docker compose -f docker-compose.base44.yml up -d` brings up a single `web`
service. It runs `npm install` then `vite dev --host 0.0.0.0` from a bind-mount
of the repo, so edits hot-reload (Vite watcher uses polling — already configured in
`vite.config.ts`).

- Dev server listens on container port **8080**, mapped to host **3000**.
- `server.host: 0.0.0.0` and `allowedHosts: true` are already set in
  `vite.config.ts`, so the preview's external hostname is accepted.
- Healthcheck curls `http://localhost:8080/`; container goes healthy once Vite
  is ready (~1 min after first boot for `npm install`).

## Secrets / Supabase
The app imports `@supabase/supabase-js`. The client (`src/integrations/supabase/client.ts`)
falls back to `https://placeholder.supabase.co` when the URL/key are absent, so it
boots without credentials — but auth/data won't work.

A real Supabase project IS connected. The platform delivers three secrets to
`/run/base44/app.env` (wired as the `web` service's `env_file`):
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**Naming quirk — important:** the client/server code reads `VITE_SUPABASE_URL`
and `VITE_SUPABASE_PUBLISHABLE_KEY` (Vite only exposes `VITE_`-prefixed vars to
the browser via `import.meta.env`), but the saved secrets are named without the
`VITE_` prefix. The compose `command` aliases them at runtime with double-quoted
shell exports BEFORE `npm run dev`:
`export VITE_SUPABASE_URL="$SUPABASE_URL"` (and the publishable key). Do NOT use
single quotes — they suppress expansion and leave the literal `$SUPABASE_URL`,
which the Supabase client rejects as an invalid URL (500 on every route).
`SUPABASE_SERVICE_ROLE_KEY` needs no alias (server code reads it from
`process.env` directly).

After a secret change the platform recreates the service; otherwise `docker
compose -f docker-compose.base44.yml up -d --force-recreate` re-applies the
aliasing. Verify presence with `docker compose exec -T web sh -c 'printenv
SUPABASE_URL >/dev/null && echo present'` (never print the value).

## Auth / Discord OAuth
- `/auth` renders the sign-in page with a "Continue with Discord" button
  (`supabase.auth.signInWithOAuth({ provider: "discord" })`) and email/password.
- `/auth-callback` (`src/routes/auth-callback.tsx`) completes the OAuth round-trip:
  it calls `supabase.auth.exchangeCodeForSession(window.location.href)` and
  redirects to `/` on success or `/auth` on failure. The repo originally
  referenced `/auth-callback` as the OAuth redirect target but had no route for
  it; this route was added to make the flow work.
- The full Discord round-trip can't be exercised inside the preview iframe
  (Discord blocks framing). The initiation is verifiable server-side: curl the
  Supabase `/auth/v1/authorize?provider=discord` endpoint (with the publishable
  key as `apikey`) — it returns a 302 to `https://discord.com/api/oauth2/authorize`.
  The preview origin is accepted as the `redirect_to`.

## Verifying it works
- `docker compose -f docker-compose.base44.yml ps` → `web` is `Up (healthy)`.
- `curl -sf http://localhost:3000/` → 200.
- `curl -sf -H "Host: external-preview.example.com" http://localhost:3000/` → 200
  (confirms the preview's external hostname is accepted).
- Preview shows the NOVA sign-in page at `/auth`.

## Notes
- No lockfile is committed; `npm install` resolves fresh each first boot
  (~45s). `node_modules` is created inside the bind mount and persists across
  restarts.
- The app uses TanStack Start SSR (`src/server.ts` is a fetch-handler entry);
  `vite dev` runs the full SSR dev server, not a static SPA preview.
