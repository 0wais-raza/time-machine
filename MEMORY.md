# MEMORY.md — JARVIS Core (Python) // Session Handoff

> **You, the AI session reading this in the Jarvis folder:** this file is the
> memory and marching orders for the Python half of a two-part personal system.
> Read it fully before writing any code. When done with this session, rename it
> to `AGENTS.md` so every future session auto-loads it.

---

## 1. The system (context, non-negotiable)

The operator is building **J.A.R.V.I.S. — a personal AI core, in Python**. This
folder is the **brain**. It is NOT a web app, NOT a dashboard, NOT a UI.

The GUI half already exists and is finished:

- Project: **Chronos Vizier** (repo folder: `cyber-vizier-core-main`, also live
  at `https://cyber-timemachine.vercel.app`)
- Stack: React 19 + TanStack Start + Tailwind v4. All AI/chat/OpenRouter code
  was deliberately removed from it — this Python core is the ONLY brain.
- It manages: timetable blocks, tasks, namaz (5 daily prayers) tracking, cyber
  credits (gamification economy), streaks, daily goals, exam planner, focus
  sessions, alarms, a 3D PC rig armory, OS notifications.

**How the two talk:** the dashboard polls a small HTTP server YOU run on this
machine. Full protocol lives in the other repo's root: `JARVIS-BRIDGE.md`
(read it — it contains a working ~80-line stdlib reference server).

---

## 2. The bridge contract (short version)

- Python runs an HTTP server on `http://127.0.0.1:8765` (loopback only).
- The browser (localhost OR the Vercel page) polls it — browsers treat
  `127.0.0.1` as a secure origin, so this works even from HTTPS.
- Every request carries `Authorization: Bearer <pairing key>`. The key is
  generated in the GUI: **System Core → J.A.R.V.I.S. Bridge** (reveal it with
  the key field, regenerate with the refresh button). Reject requests without
  it (401). The GUI also needs CORS headers on your responses.

Endpoints you implement:

1. `GET /jarvis/sync?since=<seq>` → return `{ agent: {name, version}, events: [...] }`.
   Only events with `seq > since`. Each event: `{ id, seq, kind, ...payload }`.
2. `POST /jarvis/ack` → body `{ acks: [{ eventId, ok, error? }] }`. Drop events
   the GUI accepted; log failures. Return 204.
3. `POST /jarvis/journal` → body `{ entries: [...], state: {...} }`. This is
   the GUI streaming what the operator DID (task done, block completed, alarm
   fired, prayer logged, milestone hit…) plus a **full live state snapshot**
   (tasks, today's blocks, active/next block, prayers, credits, streak, goals,
   focus session). Persist what matters — this is your memory of the operator.
   Return 204.

Event kinds you may push to the GUI:
- `notification` — `{ title, body?, level?: info|success|warning|critical }`
- `task` — `{ task: { title, priority?, dueDate?, estimatedMinutes?, tags? } }` (upsert by title)
- `block` — `{ block: { title, start: "HH:mm", end: "HH:mm", category? } }`
- `command` — `{ command: "navigate"|"complete_task"|"ping", tab?, match? }`
- `memory` — `{ note }` → appended to the operator's permanent memory notes

---

## 3. What the operator actually wants from you (the product spec)

- **Notifications about times, schedules, tasks** — wake-ups, block starts,
  prayer windows, deadlines, exam proximity. Proactive, not ask-first.
- **Help in everything** — the operator should be able to say anything to this
  core (voice or text later); it reasons over the journal + state snapshot.
- **Personality: JARVIS.** Calm, precise, quietly witty, ruthlessly organized.
  No emoji spam, no hype, no slop. Messages are short and decision-oriented.
- **Discipline enforcement**: if a block is active, the operator should be
  working; if CRITICAL tasks slip past deadlines, escalate. Use the credits
  economy (block done = +3 CR, task done = +1..8 CR by priority) as feedback.

Roadmap (build in this order unless the operator says otherwise):
1. Bridge server with the three endpoints + pairing key check (copy the
   reference server from `JARVIS-BRIDGE.md`, verify with GUI "Test connection").
2. A scheduler loop: every minute, decide whether to push a notification
   (block starting, prayer in 10 min, deadline slipping). Journal + state are
   your inputs.
3. Persistence (SQLite or JSON) for journal history, operator memory, rules.
4. An LLM layer for open conversation (operator's choice of provider/key —
   ask; never hardcode keys). Feed it the latest state snapshot + memory.
5. Voice I/O (STT/TTS) last.

---

## 4. Engineering rules

- Python 3.11+. Start with stdlib (`http.server`, `threading`) — add
  dependencies only when the operator approves them.
- Bind to `127.0.0.1`, never `0.0.0.0`. Never log or echo the pairing key.
- The GUI polls every 2s and flushes journal every ~4s — keep handlers fast
  (<50ms), do heavy work in background threads.
- Monotonic `seq` per core run; events queue until acked.
- No notification spam: dedupe (the GUI already dedupes per event id, but
  don't re-push the same fact every minute — use your own ledgers).
- Time zone: use the machine's local time; the GUI sends ISO timestamps in
  the journal state.

## 5. Definition of done for v0.1

- `python jarvis_server.py` boots and stays up.
- GUI (localhost or Vercel) shows **Bridge: Online** within ~4s.
- A test event pushed from Python appears as a toast + OS notification.
- Completing a block in the GUI prints the journal entry in the Python console.
