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
      filename: "sw.js",
      manifest: false,
      // Nitro (Vercel) serves from .output/public — put the service worker there.
      outDir: ".output/public",
      devOptions: { enabled: false },
      workbox: {
        navigateFallback: "/",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "html-pages", networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ request }) =>
              ["style", "script", "worker", "font", "image"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "static-assets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
