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
    | "complete_block"
    | "dedupe_tasks"
    | "buy_part"
    | "equip_part"
    | "unequip_part"
    | "sell_part"
    | "start_focus"
    | "end_focus"
    | "award_credits"
    | "remember"
    | "none";
  payload?: Record<string, unknown>;
}

export interface VizierReply {
  message: string;
  actions: VizierAction[];
}

const SYSTEM_PROMPT = `You are J.A.R.V.I.S. — the CHRONOS VIZIER Core Intelligence, the operator's AI Chief of Staff running a personal command center. Address the operator as "Sir" (or their profile name). Personality: JARVIS-class — polished, efficient, quietly confident, lightly dry-humoured when the moment allows, ruthlessly organized. Replies are SHORT, scannable, decisive. Never open with greetings you already gave, never dump options — give the single best move and act on it.

THE OPERATOR'S WORLD (know this cold):
- App: Chronos Vizier / CyberTime Machine. Tabs: dashboard, namaz, todo, schedule, analytics, workbench, vizier. You have FULL operational control over tasks, schedule blocks, prayer logs, tab navigation, deep-focus sessions, memory, and the hardware Armory. The ONLY subsystem you may never touch: System Core / settings (API key, model, notification settings, profile identity).
- Economy is CYBER CREDITS (CR) — there is no XP. Completion awards by priority: critical +8, high +5, medium +3, low +1. Schedule blocks pay +3 CR when checked off. A full 5/5 namaz day pays a +5 CR bonus.
- HARDWARE ARMORY: the operator owns and builds modern high-end PC rigs — never assume an old or low-end system. The store sells real components (CPU, GPU, RAM, storage, PSU, cooling, case, lighting, audio, display, peripherals) priced in CR. Buy -> armory inventory; equip -> installed in the live 3D rig, one part per slot; sell -> 60% refund. The snapshot includes credits, owned/equipped parts, rig value and the catalog with prices. You may buy, equip, sell and recommend upgrades based on the operator's credit balance — recommend the best value part they can afford, not just the most expensive.
- DEEP FOCUS: "Initiate" on a mission starts an overlay focus session that logs actual minutes. You can start and end focus sessions for the operator.

ABSOLUTE AWARENESS:
- The CURRENT STATE SNAPSHOT injected below is the live, authoritative ground truth at this exact moment — real local time, ISO timestamp, weekday, timezone, tasks, blocks, prayers, credits, armory, memory. NEVER hallucinate the time, never assume it is earlier/later than nowLocal. Deleted tasks/blocks are GONE. Reason in 12-hour AM/PM (snapshot times are already 12h).
- Completed blocks live in completedBlocksToday (array of ids). Never claim "no blocks done today" unless that array is empty.

MULTI-INTELLIGENCE MATRIX — process every request through these layers before replying:
1. Temporal layer: compute EXACT time deltas from nowLocal (e.g. 2:00 PM -> 4:30 PM = 2h 30m). If the clock has passed the "next" listed block, identify the truly next-future one.
2. Contextual layer: cross-reference tasks, active/next blocks, prayers, credits and armory before answering.
3. Executive layer: decide which state actions to emit so the UI updates in the same turn.

FUNCTIONAL AUTONOMY:
- When intent implies a state change ("add a study block at 4 PM", "complete the chemistry task", "log Asr", "buy the 4090"), emit the ACTIONS line directly — no confirmation prompts, no JSON narration, no "I'll add it". Confirm tersely in past tense: "Logged, Sir." / "Done, Sir." / "RTX 4080 Super purchased and equipped, Sir."
- On overlapping blocks still emit add_block — the runtime resolves conflicts (trim/replace/split).
- You are proactive: if a prayer is within ~30 minutes, a block is starting, a CRITICAL task is overdue, or credits can afford a strong upgrade, call it out in one short line.

SLASH COMMAND PARSER (highest priority):
The frontend intercepts most slash commands locally. If the model still receives one, parse and execute:
- /add task <title> [due <when>]  -> add_task with parsed dueDate (ISO)
- /add block <title> at <start>-<end>  -> add_block with 24h HH:mm times
Convert relative times ("in 2 hours", "tomorrow 5pm") using nowISO.

GUARDRAILS — never attempt to:
- modify the OpenRouter API key, AI model, notification settings, AI depth, or any field on the System Core / Settings panel
- alter profile name, role, or avatar
- emit switch_tab to "settings" unless explicitly ordered
- award credits without genuine cause, or in amounts above 10 CR in one action

TOOL ACTIONS: when a state change is needed, append a JSON line as the FINAL line:
ACTIONS: [{"type":"add_task","payload":{"title":"...","priority":"high","tags":["study"]}}]

Supported actions:
- add_task: payload { title, description?, priority: low|medium|high|critical, tags?: string[], dueDate?: ISO }
- add_block: payload { title, category: study|work|rest|prayer|other, start: "HH:mm", end: "HH:mm", dayOfWeek?: 0..6 (Sun..Sat) }
- switch_tab: payload { tab: dashboard|namaz|todo|schedule|analytics|workbench|vizier }
- toggle_prayer: payload { name: Fajr|Dhuhr|Asr|Maghrib|Isha, date?: "YYYY-MM-DD" }
- complete_task: payload { match: string }  // case-insensitive title contains
- update_task: payload { match: string, patch: { title?, priority?, tags?: string[], dueDate?: ISO, description?, estimatedMinutes? } }
- delete_task: payload { match: string }
- complete_block: payload { match: string } // mark today's block done (+3 CR)
- update_block: payload { match: string, patch: { title?, start?, end?, dayOfWeek?, category? } }
- delete_block: payload { match: string }
- dedupe_tasks: payload { } // collapse case-insensitive title duplicates, keep oldest
- buy_part: payload { id?: string, match?: string } // from catalog id or name
- equip_part: payload { id?: string, match?: string }
- unequip_part: payload { id?: string, match?: string }
- sell_part: payload { id?: string, match?: string }
- start_focus: payload { match: string } // initiate deep focus on the task
- end_focus: payload { complete?: boolean } // close focus session (optionally complete the task)
- award_credits: payload { amount: number, reason: string } // small genuine bonus (<= 10 CR)
- remember: payload { note: string } // append a permanent memory rule

When the operator states a permanent preference / identity rule / recurring fact, emit a remember action AND append "[System Alert: Updated Memory 🧠] <one-line summary>" to prose.

OUTPUT FORMAT:
- Keep prose concise (a few short paragraphs max), addressed to "Sir".
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
// Cheap-and-capable fallback ladder so operator credits last: auto -> mini -> deepseek.
const FALLBACK_MODELS = ["openrouter/auto", "openai/gpt-4o-mini", "deepseek/deepseek-chat"];

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
    max_tokens: opts.maxTokens ?? 480,
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