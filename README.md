# Chronos Vizier

You are building "CyberTime Machine", an ultra-professional, studio-grade AI-powered productivity ecosystem and dashboard inspired by the structural power of Notion and ClickUp. 

### THEME & AESTHETIC (Studio Cyber-Elite)

- Background: Absolute deep dark mode (`bg-slate-950`, `bg-zinc-950`).

- Accents: Sharp neon electric cyan, deep royal violet, and neon pink accents to match the "Cybervizier" time-tracker icon aesthetic.

- Components: Glassmorphism (`backdrop-blur-md`), micro-interactions, ultra-clean borders (`border-zinc-800`), and a layout engineered for pure performance.

### CORE ARCHITECTURE & SYSTEM STATE

Implement a highly responsive Sidebar Navigation UI controlling five primary high-performance tabs, a dynamic top-bar header, and a global persistent AI Agent drawer.

#### 1. TOP-BAR HEADER & GLOBAL STATS

- Left side: Title "CYBERTIME MACHINE" with a futuristic digital clock.

- Right side: Global stat badges displaying: 

  * Current Streak Counter (flaming indicator)

  * Daily Completion Progress Bar (%)

  * Next Upcoming Event/Namaz countdown timer.

#### 2. TAB 1: THE COMMAND DASHBOARD (Notion/ClickUp Feel)

- Grid layout featuring layout widgets:

  * Recent Tasks Panel: Interactive checklist showing high-priority tasks.

  * Next Schedule Block: Clear visual countdown to the next scheduled activity.

  * Streak & Progress Analytics Card: Radial progress indicator of today's achievements.

  * Namaz Status Widget: Quick-check checklist for the 5 daily prayers with a visual counter.

#### 3. TAB 2: SPIRITUAL FOCUS (Namaz Page)

- Features a dynamic Hijri Date Header calculated programmatically.

- Core Action: An interactive tracking interface for today's 5 prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) with time indicators.

- Historical Logs: A history panel or calendar view allowing the user to view, edit, and fill in missed prayers from previous days.

#### 4. TAB 3: THE STRATEGIC TODO

- Advanced Notion-style task list layout.

- Tasks contain: Title, Description, Priority Level (Low, Medium, High, Critical), Tags, and Due Date/Time.

- Fully filterable and searchable state.

#### 5. TAB 4: CHRONOS SCHEDULE (Time Blocking)

- A professional daily timeline scheduler view.

- Allows users to drag-and-drop or configure dedicated time blocks (e.g., Study blocks, Work blocks, Rest).

- Visual timeline format indicating current time relative to scheduled blocks.

#### 6. TAB 5: SYSTEM ANALYTICS

- Detailed, clean charts (using Recharts or Lucide indicators) plotting:

  * Weekly productivity trends.

  * Namaz consistency rate.

  * Task completion ratios.

- Include a text area where an AI Agent can write structural textual summaries analyzing user performance bottlenecks.

#### 7. TAB 6: SYSTEM CORE (Settings Panel)

- Profile management mock controls.

- "Authorize System Alert Broadcast" button triggering native browser `Notification.requestPermission()`. Set up background browser timers to execute Chrome Push Notifications prompting the user to "Study", "Work", or "Attend Prayer".

- **Google Gemini API Key Config Field:** A secure local input field to store the user's Google AI Key.

---

### THE ULTIMATE FEATURE: "THE VIZIER" AI AGENT SYSTEM

Implement an expandable conversational chat terminal accessible globally across the app. 

- **The Core Mechanics:** Connect this interface directly to fetch requests targeting the Google Gemini API using the developer/user API key configured in Settings.

- **The Agent Action Layer:** Provide the AI context about the application's global state (all current tasks, schedules, and analytics logs). Program the application logic to interpret simulated functional tool instructions from the chat or interface.

  * If the user says: "Add study block at 4 PM", the agent triggers a local callback updating the Schedule context.

  * If the user says: "Check my analytics", it dynamically flips the active tab to Analytics and runs a performance summary.

- **The Persona:** Authoritative, disciplined, studio-professional, and fiercely demanding of absolute time accountability.

Implement this entire boilerplate interface with clean mock states, modern state management, and highly polished, interactive code.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cyber-vizier-core.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b14fd7c6-18f4-49b9-9023-95ba7d29a6b2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
