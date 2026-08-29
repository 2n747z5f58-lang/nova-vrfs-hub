import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Server functions are same-origin RPC endpoints, and TanStack Start protects
// them by default — but ONLY for apps that do not define this file:
//
//   requestMiddleware: hasStartInstance ? startOptions.requestMiddleware : [defaultCsrfMiddleware]
//                                                      (start-server-core/createStartHandler.js)
//
// Defining src/start.ts therefore REPLACES the default rather than adding to it,
// so every app built on this template shipped its server functions open to
// cross-site requests. Nothing surfaced it: the framework's missing-CSRF warning
// is gated on `NODE_ENV !== "production"`, so the one environment where it
// mattered was the one environment that stayed silent.
//
// Filtered to `serverFn` to match the framework's own default exactly — server
// ROUTES are ordinary HTTP endpoints that may legitimately be called
// cross-origin, and blanket-protecting them would break webhooks.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  // errorMiddleware first: it wraps the rest, so a throw from the CSRF check
  // still renders the branded error page instead of an unhandled 500.
  requestMiddleware: [errorMiddleware, csrfMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
