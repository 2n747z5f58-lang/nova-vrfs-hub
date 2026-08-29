import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to={"/" as any}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Loaders and server functions commonly throw a raw Response rather than an
// Error. `String(it)` on one is the opaque "[object Response]", which is then all
// the runtime-error card — and the agent's fix loop reading it — has to work
// with, so pull out the status and URL instead.
function describeBoundaryError(error: unknown): { message: string; stack: string } {
  if (error instanceof Response) {
    const url = error.url ? ` at ${error.url}` : "";
    return { message: `Response ${error.status}${url}`, stack: "(no stack)" };
  }
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack ?? "(no stack)" };
  }
  return { message: String(error), stack: "(no stack)" };
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  // The single reporting channel: cloudflare/worker.js wraps console.error and
  // beacons it to the editor. Deliberately NOT a second reporter module — see
  // sandbox/vite-config-patcher.ts and sandbox/error-beacon.test.ts for the two
  // production breakages that caused.
  const { message, stack } = describeBoundaryError(error);
  console.error("[render-boundary]", message, "\n", stack);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NOVA — VRFS Esports Football" },
      { name: "description", content: "The professional home for VRFS football leagues, fixtures and statistics." },
      { name: "author", content: "Vibely" },
      { property: "og:title", content: "NOVA — VRFS Esports Football" },
      { property: "og:description", content: "The professional home for VRFS football leagues, fixtures and statistics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Vibely" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Without this the browser requests /favicon.ico on every page load and
      // gets a 404 — harmless (it is already filtered as noise server-side) but
      // it leaves every generated app with the browser's blank-page tab icon.
      // SVG rather than .ico so it stays editable text the agent can restyle to
      // match the app it just built.
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
