import { useApp, PRAYERS, todayStr } from "./store";
import { to12h } from "./clock";

export interface ScheduledEvent {
  id: string;
  title: string;
  body: string;
  at: string; // ISO timestamp — when to fire
  tag?: string;
}

/** Horizon: events beyond ~25h are re-armed next time the app is opened. */
const HORIZON_MS = 25 * 60 * 60 * 1000;

/**
 * Build the list of upcoming system events from LIVE store state. Used to arm
 * the service worker so notifications fire even when the app/tab is closed
 * (as long as the browser process is running).
 */
export function buildUpcomingEvents(): ScheduledEvent[] {
  const s = useApp.getState();
  const now = new Date();
  const nowMs = now.getTime();
  const horizon = nowMs + HORIZON_MS;
  const today = todayStr();
  const events: ScheduledEvent[] = [];

  // Task deadlines.
  for (const t of s.tasks) {
    if (t.done || !t.dueDate) continue;
    const due = new Date(t.dueDate).getTime();
    if (due > nowMs && due <= horizon) {
      events.push({
        id: `deadline:${t.id}`,
        title: `Deadline // ${t.title}`,
        body: "Execute now.",
        at: t.dueDate,
        tag: `cv-deadline-${t.id}`,
      });
    }
  }

  // Schedule blocks starting today (future).
  const dow = now.getDay();
  const todayBlocks = s.blocks.filter((b) => {
    const d = typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
    return d === dow;
  });
  for (const b of todayBlocks) {
    const [h, m] = b.start.split(":").map(Number);
    const at = new Date(now);
    at.setHours(h, m, 0, 0);
    if (at.getTime() > nowMs && at.getTime() <= horizon) {
      const range = `${to12h(b.start)} – ${to12h(b.end)}`;
      events.push({
        id: `block:${b.id}:${today}`,
        title: `Block // ${b.title}`,
        body: range,
        at: at.toISOString(),
        tag: `cv-block-${b.id}-${today}`,
      });
    }
  }

  // Prayer approach today (future, not yet logged).
  const dayTimes = s.prayerTimes[today] ?? {};
  for (const p of PRAYERS) {
    if (s.prayers[today]?.[p.name]) continue;
    const t = dayTimes[p.name] ?? p.time;
    const [h, m] = t.split(":").map(Number);
    const at = new Date(now);
    at.setHours(h, m, 0, 0);
    if (at.getTime() > nowMs && at.getTime() <= horizon) {
      events.push({
        id: `prayer:${p.name}:${today}`,
        title: `${p.name} approaching`,
        body: to12h(t),
        at: at.toISOString(),
        tag: `cv-prayer-${p.name}-${today}`,
      });
    }
  }

  return events.sort((a, b) => a.at.localeCompare(b.at));
}
