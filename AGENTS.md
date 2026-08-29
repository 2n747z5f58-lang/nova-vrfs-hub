<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# NOVA VRFS Hub — Base44 dev environment

## Stack
TanStack Start (Vite 8, SSR) + React 19 + Tailwind v4 + Supabase. The web app is
the only service needed for the preview. `bot/` is a separate Discord bot (not
run here).

## Running here
`docker compose -f docker-compose.base44.yml up -d` — single `web` service on
node:22-slim, repo bind-mounted at /app, `npm install` + `vite dev` on port 3000.
Live reload is on (Vite watches the bind mount with debounced polling).

## Supabase (external, required at boot)
The app connects to a **hosted** Supabase project — there is no local DB service.
Three secrets are required and delivered via `/run/base44/app.env`:
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (browser client), `SUPABASE_SERVICE_ROLE_KEY` (SSR).
The compose command derives the Vite-exposed `VITE_SUPABASE_URL` /
`VITE_SUPABASE_PUBLISHABLE_KEY` from the non-prefixed secrets at startup
(Vite only exposes `VITE_`-prefixed vars to client code). `.env.base44-defaults`
holds placeholders so the dev server boots before real credentials land; the
real secrets (last `env_file` entry) always override them.

## Quirks
- `vite.config.ts` uses Lovable's `defineConfig` (`@lovable.dev/vite-tanstack-config`),
  which hard-codes `server.host/port` and does NOT set `allowedHosts`. A `vite.server.allowedHosts: true`
  option is added so the Base44 preview's external hostname is not 403-blocked.
- The Lovable config forces port 8080 internally; the compose overrides to 3000
  via CLI flags (`--host 0.0.0.0 --port 3000`).

## Verify
`curl -sf -H "Host: external-preview.example.com" http://localhost:3000/` → 200
with SSR'd NOVA HTML. Data pages (e.g. `/standings`, `/teams`) return 200 with
real content once Supabase secrets are present.
