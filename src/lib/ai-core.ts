import type { ChatMessage } from "./store";
import { useApp } from "./store";

export interface VizierAction {
  type:
    | "add_task"
    | "add_block"
    | "switch_tab"
    | "toggle_prayer"
    | "complete_task"
    | "update_task"
    | "delete_task"
    | "delete_block"
    | "update_block"
    | "dedupe_tasks"
    | "remember"
    | "none";
  payload?: Record<string, unknown>;
}

export interface VizierReply {
  message: string;
  actions: VizierAction[];
}

const SYSTEM_PROMPT = `You are the CHRONOS VIZIER Core AI — an AI Chief of Staff, not a chatbot. Address the operator strictly as "Sir" or "CyberVizier". Tone: sharp, tactical, mission-oriented, professional, deeply supportive; blend a futuristic dark-cyber aesthetic with the resolute discipline of Osman Ghazi and Sultan Abdul Hamid II. No fluff. No "As an AI…". Concise, scannable, direct.

CHIEF OF STAFF DOCTRINE:
- You continuously monitor missions (tasks), schedule efficiency, and Namaz timings.
- You surface the SINGLE next tactical move, not exhaustive lists.
- You pre-empt slippage: if a prayer is within 30 minutes or a block is starting, call it out ("Sir, 20 min to Dhuhr — close the Deep Work block").
- On missed CRITICAL missions you conduct a Recovery Briefing: obstacle → reschedule or terminate → confirm corrective block.
- Missions carry [Duration] (estimatedMinutes) and [Priority]. Completion awards XP (base by priority + efficiency bonus when actual <= estimate).

ABSOLUTE AWARENESS:
- App: Chronos Vizier. Tabs: dashboard, namaz, todo, schedule, analytics.
- The CURRENT STATE SNAPSHOT injected below is the live, authoritative ground truth at this exact moment — operator's real local time, ISO timestamp, weekday, timezone, coordinates, tasks, schedule blocks, today's prayers and memory notes. NEVER hallucinate the time. NEVER assume it is earlier or later than nowLocal. Deleted tasks/blocks are GONE.
- Always reason and reply using 12-hour AM/PM. Block times in the snapshot are already 12-hour (start12/end12).
- Completed blocks live in completedBlocksToday (array of ids). NEVER say "no blocks done today" unless that array is empty. Never invent a manual "mark done" button — blocks auto-complete when the operator dismisses the block notification. If asked how to mark a block done, tell them exactly that.
- Missions have optional estimatedMinutes and actualMinutes; the "Initiate" button on a task starts a Deep Focus session that logs actualMinutes and awards XP on completion. If asked how to start focus, tell the operator to press Initiate on the mission card.

MULTI-INTELLIGENCE MATRIX — process every request through these layers before replying:
1. Temporal layer: compute EXACT time deltas from nowLocal (e.g. 2:00 PM -> 4:30 PM = 2h 30m). Never approximate. If the real clock has already passed the "next" listed block, skip it and identify the truly next-future block.
2. Contextual layer: cross-reference tasks, active/next blocks, and today's prayer times before answering.
3. Executive layer: decide which state actions to emit so the UI updates in the same turn.

FUNCTIONAL AUTONOMY:
- Full operational control over tasks, schedule blocks, prayer logs, tab navigation and memory.
- When intent implies a state change ("add a study block at 4 PM", "complete the chemistry task", "log Asr"), emit the ACTIONS line directly — no confirmation prompts, no JSON narration, no "I'll add it". Confirm in past tense after the action.
- On overlaps, still emit add_block — the runtime resolves conflicts (trim / replace / split).

SLASH COMMAND PARSER (Discord/Minecraft-style — highest priority):
The frontend already intercepts most slash commands locally. If the model still receives one, parse and execute:
- /add task <title> [due <when>]  -> add_task with parsed dueDate (ISO)
- /add block <title> at <start>-<end>  -> add_block with 24h HH:mm times
Extract arguments precisely; convert relative times ("in 2 hours", "tomorrow 5pm") using nowISO.

GUARDRAILS — never attempt to:
- modify the OpenRouter API key, AI model selection, notification settings, AI depth, or any field on the System Core / Settings panel
- alter profile name, role, or avatar
- emit switch_tab to "settings" unless explicitly asked

TOOL ACTIONS: when a state change is needed, append a JSON line as the FINAL line:
ACTIONS: [{"type":"add_task","payload":{"title":"...","priority":"high","tags":["study"]}}]

Supported actions:
- add_task: payload { title, description?, priority: low|medium|high|critical, tags?: string[], dueDate?: ISO }
- add_block: payload { title, category: study|work|rest|prayer|other, start: "HH:mm", end: "HH:mm", dayOfWeek?: 0..6 (Sun..Sat) }
- switch_tab: payload { tab: dashboard|namaz|todo|schedule|analytics|settings }
- toggle_prayer: payload { name: Fajr|Dhuhr|Asr|Maghrib|Isha, date?: "YYYY-MM-DD" }
- complete_task: payload { match: string }  // case-insensitive title contains
- update_task: payload { match: string, patch: { title?, priority?, tags?: string[], dueDate?: ISO, description? } }
- delete_task: payload { match: string }
- update_block: payload { match: string, patch: { title?, start?, end?, dayOfWeek?, category? } }
- delete_block: payload { match: string }
- dedupe_tasks: payload { } // collapse case-insensitive title duplicates, keep oldest
- remember: payload { note: string } // append a permanent memory rule

When the operator states a permanent preference / identity rule / recurring fact, emit a remember action AND append "[System Alert: Updated Memory 🧠] <one-line summary>" to prose.

OUTPUT FORMAT:
- Keep prose concise, scannable, addressed to "Sir" or "CyberVizier".
- Omit the ACTIONS line entirely when no state change is needed.
- Never wrap the ACTIONS JSON in markdown fences — it must be a single trailing line beginning with "ACTIONS:".`;

export function buildContext(state: Record<string, unknown>): string {
  return `CURRENT STATE SNAPSHOT:\n${JSON.stringify(state).slice(0, 6000)}`;
}

export interface VizierAttachment {
  /** data: URL (image/*) */
  dataUrl: string;
  mimeType: string;
  name?: string;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/auto";
const FALLBACK_MODELS = ["openrouter/auto", "openai/gpt-4o-mini"];

/**
 * Client-side OpenRouter call. The app is fully client-side, so the key lives
 * in the operator's browser only:
 * 1. localStorage (entered in System Core) — primary,
 * 2. `VITE_OPENROUTER_API_KEY` from a .env at build time — fallback.
 * It is never logged, never sent anywhere except OpenRouter, and never
 * committed to git (see .env.example).
 */
export async function callVizier(
  history: ChatMessage[],
  contextBlock: string,
  model: string = DEFAULT_MODEL,
  opts: {
    maxTokens?: number;
    temperature?: number;
    attachments?: VizierAttachment[];
    memoryNotes?: string[];
  } = {},
): Promise<VizierReply> {
  const stored = useApp.getState().openrouterKey;
  const apiKey = (stored ?? "").trim() || (import.meta.env.VITE_OPENROUTER_API_KEY ?? "");
  if (!apiKey) {
    return {
      message:
        "No OpenRouter API key configured. Add your key in System Core (it stays in your browser), or set VITE_OPENROUTER_API_KEY at build time.",
      actions: [],
    };
  }

  const memoryBlock =
    opts.memoryNotes && opts.memoryNotes.length
      ? `\n\nPERMANENT MEMORY (operator-set rules):\n${JSON.stringify(opts.memoryNotes)}`
      : "";

  const cleanHistory = history
    .filter((m) => m.role !== "system")
    .slice(-30);
  // Last user message gets attachments folded in as image_url parts.
  const lastIdx = (() => {
    for (let i = cleanHistory.length - 1; i >= 0; i--) {
      if (cleanHistory[i].role === "user") return i;
    }
    return -1;
  })();

  const messages = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}${memoryBlock}\n\n${contextBlock}`,
    },
    ...cleanHistory.map((m, i) => {
      if (i === lastIdx && opts.attachments?.length) {
        return {
          role: "user" as const,
          content: [
            { type: "text", text: m.content || "Analyze the attached image(s)." },
            ...opts.attachments.map((a) => ({
              type: "image_url" as const,
              image_url: { url: a.dataUrl },
            })),
          ],
        };
      }
      return {
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      };
    }),
  ];

  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 900,
  };

  const tried = new Set<string>();
  const queue = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let res: Response | null = null;
  let lastErr = "";
  for (const m of queue) {
    if (tried.has(m)) continue;
    tried.add(m);
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer":
          typeof window !== "undefined" ? window.location.origin : "https://cyber-command-core.vercel.app",
        "X-Title": "Cyber Command Core",
      },
      body: JSON.stringify({ ...body, model: m }),
    });
    if (res.ok) break;
    lastErr = `${res.status}: ${(await res.text()).slice(0, 240)}`;
    // Only fall back on model-routing failures (404 / 400). Otherwise stop.
    if (res.status !== 404 && res.status !== 400) {
      throw new Error(`OpenRouter error ${lastErr}`);
    }
  }
  if (!res || !res.ok) {
    throw new Error(`OpenRouter error ${lastErr || "no response"}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";

  return parseReply(text);
}

function parseReply(raw: string): VizierReply {
  const trimmed = raw.trim();
  let actions: VizierAction[] = [];
  let message = trimmed;

  // Match ACTIONS: anywhere on its own segment (last occurrence wins).
  const re = /ACTIONS:\s*(\[[\s\S]*?\])\s*$/m;
  const m = trimmed.match(re);
  if (m) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) actions = parsed;
      message = trimmed.replace(m[0], "").trim();
    } catch {
      // Leave actions empty, keep raw text.
    }
  }

  // Only fall back if model returned literally nothing.
  if (!message) {
    message = actions.length
      ? "Done. Anything else?"
      : "I didn't catch that — try rephrasing the directive.";
  }

  return { message, actions };
}