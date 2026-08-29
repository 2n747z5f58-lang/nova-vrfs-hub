// __VIBELY_DEDUPE_REACT__ (user-configured)
// __VIBELY_OPTIMIZE_ENTRIES__ (user-configured)
// __VIBELY_NO_OVERLAY__ (user-configured)
// __VIBELY_WATCH_POLL__ (user-configured)
// __VIBELY_HMR_STREAM__ (already current)
import { defineConfig } from "@vibelyai/vite-tanstack-config";

export default defineConfig({
  // Pre-scan the real source so heavy deps (three, @react-three/*) are optimized on
  // the first pass, not discovered late through the virtual client entry — otherwise
  // the re-optimize 504s the in-flight client-entry import ("Failed to fetch
  // dynamically imported module") on a cold .vite cache.
  vite: {
    optimizeDeps: { entries: ["./src/**/*.{ts,tsx,js,jsx}"] },
    // Force ONE copy of React, whatever a dependency asks for.
    //
    // React's "Invalid hook call" names three possible causes and gives no way
    // to tell them apart from the message; the third — "more than one copy of
    // React in the same app" — is the only one the platform can rule out, and
    // this is how. It matters here because `add_dependency` installs packages
    // mid-session: a package that ships its own bundled React, or one whose
    // peer range resolves to a second copy, gets a different dispatcher and
    // every hook in the tree throws. The page goes blank, so the cost is total.
    //
    // No downside to setting it: dedupe only changes how a bare `react`
    // specifier resolves, and there is exactly one react in package.json to
    // resolve to. It does not fix the other two causes (a hook called outside a
    // component, or a Rules-of-Hooks violation) — those are code, and the
    // <hooks> section of the system prompt covers them.
    //
    // `@tanstack/*` is on the list for the same reason, added after the
    // 2026-08-22 report from project 9b9d0eef: `HeadContent` threw "Cannot read
    // properties of null (reading 'useContext')" in the same millisecond as an
    // "Invalid hook call". That pair is the signature of a null dispatcher —
    // React 19 resolves hooks through `ReactSharedInternals.H` and reads
    // `.useContext` straight off it, so a second React in the tree makes the
    // read happen against the copy that is NOT rendering. Deduping `react`
    // alone did not prevent it: `HeadContent` comes from
    // `@tanstack/react-router`, which `@tanstack/react-start` also depends on,
    // and a second copy of the router pulled in under its own node_modules
    // brings a nested React with it. Pinning the router to one copy closes the
    // path the nested React arrives by.
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "@tanstack/react-router",
        "@tanstack/react-start",
        "@tanstack/react-query",
      ],
    },
    server: { host: "0.0.0.0", port: 8080, allowedHosts: true /* __MANA_ALLOWED_HOSTS__ */,
      // The file watcher — the step every other HMR setting here depends on.
      //
      // usePolling: inotify's queue is bounded and silently drops everything on
      // overflow (the kernel's IN_Q_OVERFLOW carries wd -1, libuv finds no
      // watcher for it and skips; neither libuv nor chokidar ever surfaces it).
      // An agent writing a burst of files is exactly that pattern, and the
      // symptom is a write that landed on disk with a healthy HMR socket still
      // serving the previous module. Polling never touches the queue.
      //
      // awaitWriteFinish: libuv watches IN_MODIFY, not IN_CLOSE_WRITE, so a
      // change fires mid-write. Vite's own guard retries only on a completely
      // EMPTY read, so a partially written file is transformed as-is and reaches
      // the browser as a syntax error in a file that is valid on disk moments
      // later. 150ms is short enough that streamed edits still feel live; the
      // 1000ms the config wrapper uses off-sandbox would not be.
      //
      // Kept here as well as in VitePatcher so a fresh sandbox is correct from
      // its first boot rather than from its first patch.
      //
      // ignored: paths that are the toolchain's or Vibely's, never the user's.
      // `.tanstack/tmp/*` is rewritten on every route-tree regeneration, and the
      // `.vibely-*` files plus nohup.out are written on every dev-server launch.
      // Ungated they are `add` events like any other, so they join the same
      // batch as the user's code — and a drain reloads the page, so infra churn
      // landing near a flush costs the user their route and scroll on a turn
      // that only edited existing files.
      watch: {
        usePolling: true,
        interval: 250,
        binaryInterval: 1000,
        ignored: ["**/.tanstack/tmp/**", "**/.vibely-*", "**/nohup.out"],
        awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
      },
      hmr: {
        // No red screen. This was never a decision — the key was simply never
        // set, so it took Vite's default of `true`.
        //
        // The overlay is built for a developer who owns the file that broke and
        // wants the stack immediately. Here, nobody watching the preview is that
        // person: mid-turn breakage is construction debris from an agent that is
        // still writing, and it paints a full-page red rectangle over an app that
        // was working a second ago and will be working again a second later.
        //
        // Nothing is lost by turning it off. Vite only suppresses its own
        // `console.error` WHILE the overlay is enabled, so disabling it makes the
        // error MORE visible to us, not less — and the `vite:error` payload the
        // preview bridge reports arrives over the HMR socket either way. The
        // shell decides what the user sees: the last working app with an honest
        // "fixing a build error" label, and a real error card if the fix does not
        // land.
        overlay: false,
      },
    },
  },
  // Batch the STRUCTURAL file events and release them together; let ordinary
  // edits stream straight through.
  //
  // `events` matters as much as `fullReload`, and only what an event does to the
  // PAGE decides whether it belongs in the list. Anything NOT listed bypasses the
  // gate and reaches Vite's watcher the instant it is written:
  //   change  → a granular hot update (React Fast Refresh). Left OUT on purpose,
  //     so ordinary edits stream into the preview while the agent is still
  //     writing instead of waiting for the end-of-turn flush.
  //   add / unlink → a new route file makes TanStack Start regenerate the route
  //     tree, which Vite answers with a full page reload. Gated, and released
  //     together by the end-of-turn flush.
  //
  // This list used to include "change" too. That was right while the dev server
  // only started AFTER the write loop — nothing could stream anyway. The server
  // is now live from workspace hydration onward, so gating "change" was the only
  // thing left suppressing the streaming preview.
  //
  // `fullReload` USED TO BE false, justified as "apply edits as granular hot
  // updates so the preview never flashes". That reasoning outlived the config it
  // was written for. `fullReload` governs ONLY what the drain does with the
  // GATED events — and once "change" left the list above, the gated set became
  // exactly `add`/`unlink`, which is precisely the set a granular update cannot
  // deliver: a file the agent just created is imported by nothing the loaded
  // page holds, so Vite matches zero modules and sends nothing at all (see the
  // drain in hmr-gate.js for the full mechanism). The flag was asking for
  // granular delivery of the one category that has no granular form, and the
  // preview kept showing the previous app until someone reloaded by hand.
  //
  // So: true. It costs a reload only on turns that CREATED or DELETED files —
  // which are the turns that were already ending in a forced iframe remount, or
  // in nothing at all. Edit-only turns still hot-update untouched, because their
  // events never enter the gate in the first place.
  hmrGate: { fullReload: true, events: ["add", "unlink"] },
  tanstackStart: {
    server: { entry: "server" },
  },
});
