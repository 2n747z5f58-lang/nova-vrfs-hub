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

## Secrets
**None required to boot.** The app imports `@supabase/supabase-js` but the client
(`src/integrations/supabase/client.ts`) falls back to `https://placeholder.supabase.co`
when `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are absent, so importing
it never crashes. Auth/data calls simply fail until a real Supabase project is
linked. The index route calls `supabase.auth.getSession()` (reads local storage,
no network) and redirects to `/auth` when there is no session — so the preview
lands on the sign-in page by design.

If a real Supabase backend is later needed, add `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` (and server-side `SUPABASE_SERVICE_ROLE_KEY`) via
`set_secrets`; wire `/run/base44/app.env` into the `web` service as the last
`env_file:` entry.

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
