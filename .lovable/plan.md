## Phase 3 — Production Framework & Multi-Agent Deployment

This is a large, multi-system overhaul. Executing in one tight pass, grouped by surface. Calling out a few key decisions up-front since they materially affect scope.

### Key decisions (please confirm or override)

1. **AI backend routing**: You said "non-OpenAI models exclusively via OpenRouter". The codebase currently calls OpenRouter directly with a user-supplied API key in `src/lib/gemini.ts`. I'll **keep that path** and lock the default model to `google/gemini-pro-1.5` (a strong non-OpenAI choice on OpenRouter). I will NOT switch to Lovable AI Gateway since you explicitly chose OpenRouter earlier. Confirm if you'd rather use Anthropic Claude as default.
2. **Prayer times API**: Use the **Aladhan API** (`api.aladhan.com`, free, no key) with browser geolocation. Falls back to current static array if location is denied.
3. **BGM source**: I'll wire the audio dock with an `<audio>` element but use a placeholder lofi stream URL — you can swap. No file upload for music.
4. **Vision pipeline**: Image upload → base64 → sent as `image_url` content part. OpenRouter respects this for vision-capable models. Will warn if the selected model isn't vision-capable.

### 1. 100vh viewport lock + scroll isolation
- `src/styles.css`: lock `html, body, #root` to `100vh`/`100vw`, `overflow: hidden`. Add `.scroll-y-clean` utility (thin neon scrollbar).
- `AppShell.tsx`: rebuild as a flex column with internal scroll containers. Main content area becomes `flex-1 overflow-hidden`, each tab handles its own scroll.
- Scroll allowed only in: Vizier message stream, ScheduleMatrix hours column, Todo list.
- Audit for leaked dev strings (e.g. "Enter Gemini Key" on Analytics) — strip.

### 2. Bottom-corner widgets
- **BGM Dock** (`src/components/cyber/BgmDock.tsx`): fixed bottom-right, 48px circular icon by default, expands on hover/tap to ~320px controller with play/pause, volume, track title. Audio via HTML5 `<audio>`.
- **Pomodoro** (`src/components/cyber/PomodoroDock.tsx`): fixed bottom-left, already exists or needs creating. Add editable numeric inputs for focus/break minutes.

### 3. Schedule matrix rebuild
- `ScheduleMatrix.tsx`: rebuild as fixed 7-column grid keyed by weekday name (Mon–Sun), no calendar dates. Left column = hour strip (e.g. 6am–11pm). Inner scroll only.
- Store change: `ScheduleBlock.date` → `ScheduleBlock.day: "Mon"|"Tue"|...`. Migration via persist version bump.
- **Resize vs click fix**: track a `wasResizing` flag in dnd handlers. After a resize end, set a short timeout (50ms) suppressing the next click. BlockEditor only opens on a clean click.
- Add per-block: duplicate button, color picker (5 neon swatches), delete.

### 4. Fully editable tasks
- `TodoTab`: convert title, priority, tags, description to inline-editable fields (`contentEditable` or input swap on click).
- Overdue scanner already exists; surface a red glow ring on overdue rows.

### 5. Dynamic Namaz times
- New `src/lib/prayerTimes.ts`: fetch from `https://api.aladhan.com/v1/timings/{date}?latitude=&longitude=&method=2`. Cache per-day in store.
- On Namaz tab mount, request geolocation once. Store coords in `profile`. Fallback to current static `PRAYERS` if denied.
- TopBar "next prayer" badge reads from the dynamic times.

### 6. Notification Center
- Store: add `notifications: Notification[]` (id, type, title, body, createdAt, read).
- Replace `recordMilestone`/deadline toast firing with `pushNotification(...)`.
- New `src/components/cyber/NotificationBell.tsx` in TopBar: bell icon + unread count badge. Click opens glass dropdown with list, each row has dismiss "×".
- Pipelines: milestone %, task deadline, schedule block start, prayer time approaching (10 min before).

### 7. Vizier upgrades
- `src/lib/gemini.ts`: default model `google/gemini-pro-1.5`. Add image content support (`image_url` parts).
- System message: prepend `JSON.stringify(memory.notes)` always.
- Memory capture: detect patterns like "remember that...", "my name is...", "I prefer..."; append to `memory.notes`; emit `[System Alert: Updated Memory 🧠] <summary>` in reply.
- File upload button in `VizierDrawer` composer → FileReader → base64 → attach to next message as image part.
- Action coverage: add `delete_task`, `delete_block`, `update_task`, `update_block`, `dedupe_tasks` to action parser and applier.

### 8. Hydration bug fix
- TopBar streak showing 1 vs 0 → wrap `computeStreak(...)` call in mount guard, already partially done. Tighten the guard.

### Files touched
- `src/lib/store.ts` — notifications, day-based blocks, memory, BGM/Pomodoro state, settings
- `src/lib/gemini.ts` — model default, vision payload, memory injection, expanded actions
- `src/lib/prayerTimes.ts` (new)
- `src/styles.css` — viewport lock, scroll utility
- `src/components/cyber/{AppShell,TopBar,VizierDrawer,ScheduleMatrix,BlockEditor}.tsx`
- `src/components/cyber/tabs/{Schedule,Namaz,Todo,Analytics}.tsx`
- New: `BgmDock.tsx`, `PomodoroDock.tsx`, `NotificationBell.tsx`

### Deferred (call out explicitly)
- Drawing/handwriting OCR accuracy depends on the chosen vision model — won't tune per-model
- BGM track library / multiple tracks (one placeholder stream only)
- Recurring schedule blocks across weeks (week is a single repeating template now that dates are gone)

Proceed?
