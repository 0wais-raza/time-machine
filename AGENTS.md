# Cyber Command Core (Chronos Vizier)

Personal command dashboard built with React 19, Vite, TanStack Start, Tailwind CSS v4, and three.js. Intelligence lives in the operator's own Python J.A.R.V.I.S. core — this app is the GUI half, connected via the local bridge (see `JARVIS-BRIDGE.md`).

## Commands

- `npm install` — install dependencies (npm only; bun is not used)
- `npm run dev` — local dev server
- `npm run build` — production build (Nitro output, deployable to Vercel)
- `npx tsc --noEmit` — typecheck

## Deployment

- Hosted on **Vercel** via the Nitro Vite plugin (zero-config framework detection).
- No environment variables required. There is no server-side AI and no API key —
  the J.A.R.V.I.S. bridge is browser → local Python server directly.

## J.A.R.V.I.S. Bridge

- The GUI polls the operator's Python core (`http://127.0.0.1:8765` by default)
  every 2s for events (notifications, tasks, blocks, commands) and streams an
  activity journal + state snapshot back every ~4s.
- Protocol + reference Python server: `JARVIS-BRIDGE.md`.
- Bridge settings live in System Core → J.A.R.V.I.S. Bridge (URL, pairing key,
  live status, event log). The pairing key stays in localStorage only.

## Notes

- The 3D rig is intentionally lightweight for low-end GPUs: DPR capped at 1, no
  shadows/AA/post-processing, unlit materials, and three.js is lazy-loaded only
  when the RIG ARMORY tab is opened.
- Never introduce a hosted AI provider into this repo — the operator's Python
  core is the only "brain".
