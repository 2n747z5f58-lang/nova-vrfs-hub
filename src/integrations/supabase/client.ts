// The Supabase client is pre-wired for this project. Import it — never recreate it:
//
//   import { supabase } from "@/integrations/supabase/client";
//
// The URL and publishable (anon) key are public, project-scoped values injected at
// runtime from the connected Supabase project (no secrets live here). Generated
// database types live in ./types.ts — regenerate them after every schema change.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

// False until the project is linked via the Connect Supabase card. The client
// falls back to placeholder values in that state so importing this file never
// crashes the preview — calls simply fail until the user connects. Use this to
// show "Connect Supabase to enable sign-in"-style notices instead of mocking.
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabase = createClient<Database>(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_PUBLISHABLE_KEY || "placeholder-anon-key",
);
