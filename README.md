# Chronos Vizier — Cyber Command Core

A JARVIS-inspired, AI-powered command dashboard: holographic command hub, spiritual
focus tracking, task matrix, time-blocked schedule, analytics arcade, and an
interactive 3D PC rig builder — all driven by **The Vizier**, a text-only AI chief
of staff.

Built with React 19, Vite, TanStack Start, Tailwind CSS v4, Zustand, and three.js
(React Three Fiber).

## Features

- **Holographic navigation bar** — top-mounted tactical tabs, LED accents, live telemetry.
- **RIG ARMORY & STORE** — a lightweight interactive 3D PC case (orbit/zoom) where
  equipping real hardware from the store lights up the matching part in real time.
  Tuned for low-end GPUs: DPR capped at 1, no shadows/AA/post-processing, unlit
  materials, and three.js is lazy-loaded only when the tab is opened.
- **Vizier AI** — arc-reactor HUD, "TACTICAL ADVISOR ONLINE" banner, holographic chat
  cards, and a text-only directive bar with quick-action chips.

## Development (npm only)

```sh
npm install
npm run dev
```

Other scripts: `npm run build` (production), `npm run typecheck`, `npm run lint`.

## The OpenRouter API key (client-side, secured)

This app is **fully client-side** — there is no backend, so the AI key never touches
a server you don't own. Security model:

- The key is entered in **System Core → OpenRouter API Key** and stored **only in
  your browser's localStorage**. It is sent **only to `openrouter.ai`** — never
  logged, never transmitted anywhere else, never committed to the repo.
- Optional build-time fallback: set `VITE_OPENROUTER_API_KEY` in a local `.env`
  (see `.env.example`). Note: any `VITE_` variable is embedded in the client bundle,
  so only use this for your own key on a private build.
- The key is an **OpenRouter** key (`sk-or-...`), not a Gemini key.

## Deploy to Vercel

The app uses the [Nitro Vite plugin](https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel),
so Vercel auto-detects it (framework preset: **TanStack Start**).

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import it at [vercel.new](https://vercel.new) — Vercel fills in the build settings.
3. No server environment variables are required (the AI key is client-side).
4. Deploy. Each push to `main` triggers a new deployment.

Optionally force the preset with `vercel.json` (already included):

```json
{ "framework": "tanstack-start" }
```
