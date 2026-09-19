// Static SPA-style output: SPA shell + no Cloudflare adapter split for this profile.
// Subpath deploy: `npm run build:flat -- --base=/waves/` (Vite sets `import.meta.env.BASE_URL` for the router).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/index.html",
      },
    },
  },
  vite: {
    build: {
      outDir: "dist-flat",
      emptyOutDir: true,
    },
  },
});
