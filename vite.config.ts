import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
// Nitro builds the TanStack Start server. On Vercel the platform auto-detects
// this setup (framework preset: "tanstack-start") with zero extra config.
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tanstackStart({
      // SSR error wrapper entry (src/server.ts).
      server: { entry: "server" },
      // Keep server-only code out of the client bundle.
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    nitro(),
    viteReact(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.ts", // source; emitted as sw.js via useFilename resolution
      srcDir: "src",
      manifest: false,
      strategies: "injectManifest",
      // Nitro (Vercel) serves from .output/public — put the service worker there.
      outDir: ".output/public",
      devOptions: { enabled: false },
      // Custom service worker (src/sw.ts): app-shell caching + a persisted
      // notification scheduler so alerts fire even when the tab is closed
      // (while the browser is running).
      injectManifest: {
        swSrc: "src/sw.ts",
        injectionPoint: undefined,
      },
    }),
  ],
});
