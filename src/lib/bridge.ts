/**
 * JARVIS BRIDGE — client-side connector to the operator's Python JARVIS core.
 *
 * ARCHITECTURE (the important part):
 *   Python runs a tiny HTTP server on the SAME machine (default
 *   http://127.0.0.1:8765). This web GUI — whether served from localhost OR
 *   from https://cyber-timemachine.vercel.app — polls it every 2s:
 *
 *     GET  /jarvis/sync?since=<lastSeq>   → pull new events (notifications,
 *                                           tasks, blocks, commands)
 *     POST /jarvis/ack                    → report per-event success/failure
 *     POST /jarvis/journal                → stream operator activity back
 *                                           (task done, block checked, alarm…)
 *
 *   Browsers treat http://127.0.0.1 / http://localhost as *potentially
 *   trustworthy origins*, so the HTTPS Vercel page is ALLOWED to call the
 *   local HTTP server (no mixed-content block). The Python side must answer
 *   with permissive CORS so the Vercel origin can read responses.
 *
 *   Security: every request carries `Authorization: Bearer <pairing key>`.
 *   The key is generated once in System Core → J.A.R.V.I.S. Bridge and lives
 *   only in this browser's localStorage. The Python server checks it before
 *   trusting any payload. Nothing about the bridge touches Vercel servers.
 *
 * Full protocol + a ready-to-run Python reference server: JARVIS-BRIDGE.md.
 */
import { useApp, todayStr, type Priority, type TabKey } from "./store";
import { toast } from "sonner";
import { sendSystemNotification } from "./pwa";

/* --------------------------------- types --------------------------------- */

export type BridgeEventKind = "notification" | "task" | "block" | "command" | "memory";

export interface BridgeEvent {
  id: string;
  seq: number;
  kind: BridgeEventKind;
  /** notification */
  title?: string;
  body?: string;
  level?: "info" | "success" | "warning" | "critical";
  /** task */
  task?: {
    title: string;
    description?: string;
    priority?: Priority;
    tags?: string[];
    dueDate?: string;
    estimatedMinutes?: number;
    done?: boolean;
  };
  /** block */
  block?: {
    title: string;
    category?: "study" | "work" | "rest" | "prayer" | "other";
    start: string; // HH:mm 24h
    end: string; // HH:mm 24h
    dayOfWeek?: number;
    color?: string;
    notes?: string;
  };
  /** command */
  command?: "navigate" | "complete_task" | "ping";
  tab?: string;
  match?: string;
  /** memory */
  note?: string;
  /** free-form source tag from Python, e.g. "jarvis-core@1.2" */
  source?: string;
}

export interface BridgeAck {
  eventId: string;
  ok: boolean;
  error?: string;
}

export interface BridgeJournalEntry {
  kind: string;
  at: string;
  label: string;
  meta?: Record<string, unknown>;
}

export interface BridgeHandshake {
  name?: string; // Python side's name, e.g. "jarvis-core"
  version?: string;
}

const POLL_MS = 2000;
const JOURNAL_FLUSH_MS = 4000;
const MAX_LOG = 40;

/* ------------------------------ journal queue ----------------------------- */

const journalQueue: BridgeJournalEntry[] = [];

export function recordJournal(kind: string, label: string, meta?: Record<string, unknown>) {
  if (journalQueue.length > 200) journalQueue.shift();
  journalQueue.push({ kind, at: new Date().toISOString(), label, meta });
}

/* --------------------------------- helpers -------------------------------- */

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function authHeaders(): HeadersInit {
  const key = useApp.getState().bridgePairingKey;
  return {
    "Content-Type": "application/json",
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
}

function log(message: string, level: "info" | "error" | "success" = "info") {
  useApp.getState().pushBridgeLog(message, level);
}

/* ------------------------------ event ingest ------------------------------ */

const VALID_TABS: readonly TabKey[] = [
  "dashboard",
  "namaz",
  "todo",
  "schedule",
  "analytics",
  "workbench",
  "settings",
];

export function ingestEvent(ev: BridgeEvent): BridgeAck {
  const app = useApp.getState();
  try {
    switch (ev.kind) {
      case "notification": {
        const title = (ev.title ?? "J.A.R.V.I.S.").slice(0, 120);
        const body = (ev.body ?? "").slice(0, 400);
        app.pushNotification({ kind: "jarvis", title, body });
        toast.message(title, { description: body || undefined });
        if (app.notificationsEnabled) {
          void sendSystemNotification(title, body, { tag: `bridge-${ev.id}` });
        }
        break;
      }
      case "task": {
        if (!ev.task?.title) return { eventId: ev.id, ok: false, error: "task.title required" };
        const existing = app.tasks.find(
          (t) => t.title.toLowerCase() === ev.task!.title!.toLowerCase(),
        );
        if (existing) {
          app.updateTask(existing.id, {
            description: ev.task.description ?? existing.description,
            priority: ev.task.priority ?? existing.priority,
            dueDate: ev.task.dueDate ?? existing.dueDate,
            estimatedMinutes: ev.task.estimatedMinutes ?? existing.estimatedMinutes,
            done: typeof ev.task.done === "boolean" ? ev.task.done : existing.done,
          });
        } else {
          app.addTask({
            title: ev.task.title,
            description: ev.task.description,
            priority: ev.task.priority ?? "medium",
            tags: ev.task.tags ?? ["jarvis"],
            dueDate: ev.task.dueDate,
            estimatedMinutes: ev.task.estimatedMinutes,
          });
        }
        break;
      }
      case "block": {
        if (!ev.block?.title || !ev.block.start || !ev.block.end)
          return { eventId: ev.id, ok: false, error: "block.title/start/end required" };
        app.resolveAndAddBlock({
          title: ev.block.title,
          category: ev.block.category ?? "work",
          start: ev.block.start,
          end: ev.block.end,
          date: todayStr(),
          dayOfWeek: ev.block.dayOfWeek ?? new Date().getDay(),
          color: ev.block.color,
          notes: ev.block.notes ?? (ev.source ? "via JARVIS" : undefined),
        });
        break;
      }
      case "command": {
        switch (ev.command) {
          case "navigate": {
            const tab = VALID_TABS.includes(ev.tab as TabKey) ? (ev.tab as TabKey) : null;
            if (!tab) return { eventId: ev.id, ok: false, error: `unknown tab: ${ev.tab}` };
            app.setActiveTab(tab);
            break;
          }
          case "complete_task": {
            const m = (ev.match ?? "").toLowerCase();
            const t = app.tasks.find((x) => x.title.toLowerCase().includes(m));
            if (!t) return { eventId: ev.id, ok: false, error: `no task matching "${ev.match}"` };
            app.updateTask(t.id, { done: true });
            break;
          }
          case "ping":
            break;
          default:
            return { eventId: ev.id, ok: false, error: `unknown command: ${ev.command}` };
        }
        break;
      }
      case "memory": {
        if (!ev.note) return { eventId: ev.id, ok: false, error: "note required" };
        app.addMemoryNote(ev.note.slice(0, 240));
        break;
      }
      default:
        return { eventId: ev.id, ok: false, error: `unknown kind: ${String(ev.kind)}` };
    }
    return { eventId: ev.id, ok: true };
  } catch (err) {
    return {
      eventId: ev.id,
      ok: false,
      error: err instanceof Error ? err.message : "ingest failed",
    };
  }
}

/* ------------------------------ state snapshot ----------------------------- */

export function buildBridgeState() {
  const s = useApp.getState();
  const now = new Date();
  const today = todayStr();
  const dow = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const todaysBlocks = s.blocks
    .filter(
      (b) => (typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay()) === dow,
    )
    .map((b) => {
      const [sh, sm] = b.start.split(":").map(Number);
      const [eh, em] = b.end.split(":").map(Number);
      return { ...b, sM: sh * 60 + sm, eM: eh * 60 + em };
    })
    .sort((a, b) => a.sM - b.sM);

  const activeBlock = todaysBlocks.find((b) => nowMins >= b.sM && nowMins < b.eM) ?? null;
  const nextBlock = todaysBlocks.find((b) => b.sM > nowMins) ?? null;

  return {
    timestamp: now.toISOString(),
    operator: s.profile.name,
    tab: s.activeTab,
    tasks: s.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      done: t.done,
      dueDate: t.dueDate ?? null,
      estimatedMinutes: t.estimatedMinutes ?? null,
      actualMinutes: t.actualMinutes ?? 0,
      tags: t.tags,
    })),
    blocksToday: todaysBlocks.map((b) => ({
      id: b.id,
      title: b.title,
      category: b.category,
      start: b.start,
      end: b.end,
      done: (s.completedBlocks[today] ?? []).includes(b.id),
    })),
    activeBlock: activeBlock
      ? {
          id: activeBlock.id,
          title: activeBlock.title,
          start: activeBlock.start,
          end: activeBlock.end,
        }
      : null,
    nextBlock: nextBlock
      ? { id: nextBlock.id, title: nextBlock.title, start: nextBlock.start, end: nextBlock.end }
      : null,
    prayers: s.prayers[today] ?? {},
    credits: s.credits,
    creditsToday: s.creditHistory[today] ?? 0,
    streak: s.streak,
    goals: s.goals.map((g) => ({
      id: g.id,
      title: g.title,
      target: g.target,
      unit: g.unit,
      progressToday: g.history[today] ?? 0,
    })),
    focus: s.focusTaskId
      ? {
          taskId: s.focusTaskId,
          taskTitle: s.tasks.find((t) => t.id === s.focusTaskId)?.title ?? null,
          startedAt: s.focusStartedAt,
        }
      : null,
    alarms: s.alarmSettings,
  };
}

/* -------------------------------- lifecycle -------------------------------- */

let pollTimer: number | null = null;
let flushTimer: number | null = null;
let lastSeq = 0;
let consecutiveFailures = 0;
let handshake: BridgeHandshake | null = null;
let lastJournalCount = 0;
/** Set when the connection drops, so recovery gets a "reconnected" log line. */
let wasOnline = false;

function setOnline(ok: boolean, detail?: string) {
  const app = useApp.getState();
  if (ok) {
    if (!wasOnline) {
      log(
        `Connected to J.A.R.V.I.S. core${handshake?.name ? ` (${handshake.name}${handshake.version ? ` v${handshake.version}` : ""})` : ""}`,
        "success",
      );
      app.setBridgeConfig({ bridgeStatus: "online", bridgeLastError: null });
    }
    wasOnline = true;
    consecutiveFailures = 0;
  } else {
    if (wasOnline && detail) log(`Bridge offline — ${detail}`, "error");
    wasOnline = false;
    app.setBridgeConfig({
      bridgeStatus: "offline",
      bridgeLastError: detail ?? null,
      bridgeLastSyncAt: null,
    });
  }
}

async function pollOnce(): Promise<void> {
  const app = useApp.getState();
  if (!app.bridgeEnabled) return;
  const base = normalizeUrl(app.bridgeUrl);
  if (!base) return;

  try {
    const res = await fetch(`${base}/jarvis/sync?since=${lastSeq}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(3500),
    });
    if (res.status === 401 || res.status === 403) {
      setOnline(false, "pairing key rejected — re-pair in System Core");
      return;
    }
    if (!res.ok) {
      setOnline(false, `HTTP ${res.status}`);
      return;
    }

    const data = (await res.json()) as { events?: BridgeEvent[]; agent?: BridgeHandshake };
    handshake = data.agent ?? handshake;
    const events = data.events ?? [];
    setOnline(true);

    if (events.length === 0) return;

    const acks: BridgeAck[] = [];
    for (const ev of events) {
      if (typeof ev.seq === "number" && ev.seq > lastSeq) lastSeq = ev.seq;
      acks.push(ingestEvent(ev));
    }

    // Report per-event results so Python can mark them delivered.
    void fetch(`${base}/jarvis/ack`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ acks }),
      signal: AbortSignal.timeout(3500),
    }).catch(() => {});

    useApp.getState().setBridgeConfig({ bridgeLastSyncAt: new Date().toISOString() });
  } catch (err) {
    consecutiveFailures += 1;
    // Back off quietly — the poller must never spam logs while JARVIS restarts.
    setOnline(
      false,
      consecutiveFailures <= 2
        ? err instanceof Error
          ? err.message
          : "connection failed"
        : "unreachable",
    );
  }
}

async function flushJournal(): Promise<void> {
  const app = useApp.getState();
  if (!app.bridgeEnabled || journalQueue.length === 0) return;
  const base = normalizeUrl(app.bridgeUrl);
  const batch = journalQueue.splice(0, journalQueue.length);
  lastJournalCount += batch.length;
  try {
    const res = await fetch(`${base}/jarvis/journal`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        entries: batch,
        state: buildBridgeState(),
      }),
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok && res.status !== 404) {
      // Python may not implement the journal endpoint yet — put entries back.
      journalQueue.unshift(...batch);
      lastJournalCount -= batch.length;
    }
  } catch {
    journalQueue.unshift(...batch);
    lastJournalCount -= batch.length;
  }
}

export function startBridge() {
  if (typeof window === "undefined") return;
  stopBridge();
  lastSeq = 0;
  consecutiveFailures = 0;
  wasOnline = false;
  lastJournalCount = 0;
  recordJournal("gui_boot", "Chronos Vizier GUI started");
  // First poll immediately so System Core shows status fast.
  void pollOnce();
  pollTimer = window.setInterval(() => void pollOnce(), POLL_MS);
  flushTimer = window.setInterval(() => void flushJournal(), JOURNAL_FLUSH_MS);
}

export function stopBridge() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  if (flushTimer !== null) {
    window.clearInterval(flushTimer);
    flushTimer = null;
  }
}

export function getBridgeHandshake(): BridgeHandshake | null {
  return handshake;
}

export function journalStats() {
  return { flushed: lastJournalCount, pending: journalQueue.length };
}

/** Manual "Test connection" button from System Core. */
export async function testBridgeConnection(): Promise<{ ok: boolean; message: string }> {
  const app = useApp.getState();
  const base = normalizeUrl(app.bridgeUrl);
  if (!base) return { ok: false, message: "No URL configured" };
  try {
    const res = await fetch(`${base}/jarvis/sync?since=0`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 401 || res.status === 403)
      return { ok: false, message: "Pairing key rejected by J.A.R.V.I.S." };
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    const data = (await res.json()) as { events?: BridgeEvent[]; agent?: BridgeHandshake };
    handshake = data.agent ?? null;
    const n = (data.events ?? []).length;
    return {
      ok: true,
      message: `Connected${data.agent?.name ? ` to ${data.agent.name}` : ""} · ${n} pending event${n === 1 ? "" : "s"}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unreachable — is the Python core running?",
    };
  }
}

/** Push a "send test event" through the ingest path (System Core button). */
export function simulateBridgeEvent() {
  ingestEvent({
    id: `test-${Date.now().toString(36)}`,
    seq: 0,
    kind: "notification",
    title: "J.A.R.V.I.S. test signal",
    body: "If you can read this, notifications from the bridge render correctly.",
    level: "info",
    source: "system-core-test",
  });
}
