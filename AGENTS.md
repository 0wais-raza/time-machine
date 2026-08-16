# Cyber Command Core (Chronos Vizier)

JARVIS-inspired AI command dashboard built with React 19, Vite, TanStack Start, Tailwind CSS v4, and three.js.

## Commands

- `npm install` — install dependencies (npm only; bun is not used)
- `npm run dev` — local dev server
- `npm run build` — production build (Nitro output, deployable to Vercel)
- `npx tsc --noEmit` — typecheck

## Deployment

- Hosted on **Vercel** via the Nitro Vite plugin (zero-config framework detection).
- Add a server-side environment variable `OPENROUTER_API_KEY` in Vercel's project
  settings. It is only ever read on the server (in `src/lib/vizier.ts`) and never
  ships to the browser. Local dev can use a `.env` file (see `.env.example`).

## Notes

- The 3D rig is intentionally lightweight for low-end GPUs: DPR capped at 1, no
  shadows/AA/post-processing, unlit materials, and three.js is lazy-loaded only
  when the RIG ARMORY tab is opened.
- The AI key must NOT be stored in `localStorage` or in any `VITE_` variable.
