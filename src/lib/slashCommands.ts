import { useApp, todayStr, type Priority } from "./store";

export interface SlashResult {
  ok: boolean;
  message: string;
  tab?: "todo" | "schedule";
}

/** "4pm", "4:30 pm", "16:00" -> "HH:mm" (24h). */
function parseClock(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3];
  if (Number.isNaN(h) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "tomorrow 5pm" / "2024-05-10 17:00" / "in 2 hours" -> ISO string. */
function parseDeadline(raw: string): string | undefined {
  const s = raw.trim().toLowerCase();
  const now = new Date();
  const rel = s.match(/^in\s+(\d+)\s*(min|mins|minutes|h|hr|hrs|hour|hours|d|day|days)$/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2];
    const d = new Date(now);
    if (unit.startsWith("min")) d.setMinutes(d.getMinutes() + n);
    else if (unit.startsWith("h")) d.setHours(d.getHours() + n);
    else d.setDate(d.getDate() + n);
    return d.toISOString();
  }
  const dayWord = s.match(/^(today|tomorrow)(?:\s+(.+))?$/);
  if (dayWord) {
    const d = new Date(now);
    if (dayWord[1] === "tomorrow") d.setDate(d.getDate() + 1);
    if (dayWord[2]) {
      const clock = parseClock(dayWord[2]);
      if (clock) {
        const [h, m] = clock.split(":").map(Number);
        d.setHours(h, m, 0, 0);
      }
    } else {
      d.setHours(23, 59, 0, 0);
    }
    return d.toISOString();
  }
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) return iso.toISOString();
  return undefined;
}

function inferPriority(text: string): Priority {
  const s = text.toLowerCase();
  if (/\b(critical|urgent|asap)\b/.test(s)) return "critical";
  if (/\b(high|important)\b/.test(s)) return "high";
  if (/\b(low|minor)\b/.test(s)) return "low";
  return "medium";
}

/**
 * Intercept slash commands. Returns null when the input is not a slash command
 * (caller should route to the AI). Returns a result when handled locally.
 */
export function tryHandleSlash(raw: string): SlashResult | null {
  const text = raw.trim();
  if (!text.startsWith("/")) return null;
  const store = useApp.getState();

  // /add task of <title> due <when>
  const taskRe = /^\/add(?:\s+task(?:\s+of)?)?\s+(.+?)(?:\s+due\s+(.+))?$/i;
  const blockRe =
    /^\/add\s+(.+?)\s+(?:time\s+)?block(?:\s+at)?\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/i;

  const blockM = text.match(blockRe);
  if (blockM) {
    const title = blockM[1].trim();
    const start = parseClock(blockM[2]);
    const end = parseClock(blockM[3]);
    if (!start || !end)
      return { ok: false, message: `Could not parse block times "${blockM[2]}" / "${blockM[3]}".` };
    if (start >= end)
      return { ok: false, message: `Block end (${end}) must be after start (${start}).` };
    const dow = new Date().getDay();
    store.resolveAndAddBlock({
      title,
      category: /pray/i.test(title)
        ? "prayer"
        : /rest|break|sleep/i.test(title)
          ? "rest"
          : /study|read|learn/i.test(title)
            ? "study"
            : "work",
      start,
      end,
      date: todayStr(),
      dayOfWeek: dow,
    });
    store.setActiveTab("schedule");
    return {
      ok: true,
      tab: "schedule",
      message: `Block "${title}" locked in ${start}–${end}. Overlaps resolved.`,
    };
  }

  const taskM = text.match(taskRe);
  if (taskM) {
    // Guard: don't misfire on block syntax already handled above.
    if (/\bblock\b/i.test(taskM[0])) return null;
    const title = taskM[1].replace(/^task\s+of\s+/i, "").trim();
    if (!title) return { ok: false, message: "Task title missing." };
    const dueDate = taskM[2] ? parseDeadline(taskM[2]) : undefined;
    store.addTask({
      title,
      priority: inferPriority(title + " " + (taskM[2] ?? "")),
      tags: [],
      dueDate,
    });
    store.setActiveTab("todo");
    return {
      ok: true,
      tab: "todo",
      message: `Task "${title}" added${dueDate ? ` — due ${new Date(dueDate).toLocaleString()}` : ""}.`,
    };
  }

  if (/^\/help\b/i.test(text)) {
    return {
      ok: true,
      message:
        "Commands: `/add task of <title> due <when>`, `/add <name> time block at <start>-<end>`.",
    };
  }

  return { ok: false, message: `Unknown slash command. Try /help.` };
}