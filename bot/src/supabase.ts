import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Service-role Supabase client. Server-side only — this key bypasses RLS,
 * so every sensitive action MUST be permission-checked in code first.
 */
export const db = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => {
      // New-format sb_secret_* keys are opaque strings, not bearer JWTs.
      const headers = new Headers(init?.headers);
      if (
        env.supabaseServiceRoleKey.startsWith('sb_') &&
        headers.get('Authorization') === `Bearer ${env.supabaseServiceRoleKey}`
      ) {
        headers.delete('Authorization');
      }
      headers.set('apikey', env.supabaseServiceRoleKey);
      return fetch(input as Parameters<typeof fetch>[0], { ...init, headers });
    },
  },
});

/** Throws on Supabase errors so command handlers can surface a single message. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error('No data returned from database.');
  return res.data;
}

export function maybe<T>(res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
