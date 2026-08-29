import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      // Base44 serves the dev server through a proxy hostname that changes per
      // environment; allow all hosts so the preview origin is never blocked.
      allowedHosts: true,
    },
  },
});
