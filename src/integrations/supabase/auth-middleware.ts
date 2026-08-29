// requireSupabaseAuth — function middleware for createServerFn. It validates the
// request's bearer token (attached on the client by attachSupabaseAuth, see
// ./auth-attacher) and injects { supabase, userId, claims } into the handler context.
// The injected client carries the caller's JWT, so RLS runs AS THAT USER.
//
//   import { createServerFn } from "@tanstack/react-start";
//   import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
//
//   export const listMine = createServerFn({ method: "GET" })
//     .middleware([requireSupabaseAuth])
//     .handler(async ({ context }) => {
//       const { data } = await context.supabase.from("todos").select("*"); // RLS-scoped
//       return data;
//     });
//
// Do NOT call a requireSupabaseAuth server fn from a public route's loader — during
// SSR there is no bearer token, so it will 401. Call it from a client component
// (useServerFn) or place the route under src/routes/_authenticated/.
import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

function readBearer(): string | null {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const token = readBearer();
    if (!token) throw new Response("Unauthorized", { status: 401 });

    // Request-scoped client: publishable key + the caller's JWT => RLS as that user.
    const supabase = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new Response("Unauthorized", { status: 401 });

    return next({
      context: { supabase, userId: data.user.id, claims: data.user },
    });
  },
);
