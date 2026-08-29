// SERVER-ONLY Supabase admin client. Uses the service-role key, which BYPASSES RLS.
//
// Never import this from browser code, and never import it at the top level of a
// *.functions.ts file. Inside a server-function handler, import it LAZILY so the
// service-role key can never enter the client bundle graph:
//
//   const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
//
// Reserved for: the Auth Admin API, verified webhooks, and trusted maintenance.
// For ordinary per-user reads/writes use the request-scoped client injected by
// requireSupabaseAuth (see ./auth-middleware) so RLS applies as that user.
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

// URL is public (build-inlined). The service-role key is a secret, injected into the
// server runtime as process.env.SUPABASE_SERVICE_ROLE_KEY and never bundled.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export const supabaseAdmin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
