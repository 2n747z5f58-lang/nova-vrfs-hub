// attachSupabaseAuth — global FUNCTION middleware, registered in src/start.ts. It runs
// on the CLIENT before every server-fn call and attaches the signed-in user's bearer
// token, so requireSupabaseAuth (see ./auth-middleware) can validate it on the server.
//
// The supabase client is imported LAZILY and guarded: in an app with no Supabase
// connected, VITE_SUPABASE_URL is undefined and constructing the client throws — the
// try/catch makes this a no-op so non-Supabase apps are unaffected. It also keeps the
// browser client out of the server boot path (start.ts only needs this middleware ref).
import { createMiddleware } from "@tanstack/react-start";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    try {
      const { supabase } = await import("./client");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) return next({ headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // No Supabase configured (or session unavailable) — proceed unauthenticated.
    }
    return next({});
  },
);
