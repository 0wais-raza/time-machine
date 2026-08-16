import { create } from "zustand";
import { persist } from "zustand/middleware";
import { resolveConflicts } from "./scheduleConflict";
import { partById } from "./hardware";

export type Priority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  tags: string[];
  dueDate?: string; // ISO
  done: boolean;
  createdAt: string;
  /** Mission brief: estimated duration in minutes. */
  estimatedMinutes?: number;
  /** Focus timer: minutes actually spent (accumulates across sessions). */
  actualMinutes?: number;
  /** ISO timestamp of last Initiate. */
  initiatedAt?: string;
  /** ISO timestamp of completion. */
  completedAt?: string;
  /** Cyber Credits awarded on completion. */
  credits?: number;
}

export interface ScheduleBlock {
  id: string;
  title: string;
  category: "study" | "work" | "rest" | "prayer" | "other";
  start: string; // HH:mm
  end: string; // HH:mm
  date: string; // YYYY-MM-DD (legacy, retained for compat)
  dayOfWeek?: number; // 0..6 (Sun..Sat). When set, this is a recurring weekly block.
  color?: string; // optional override neon hex/oklch
  notes?: string;
}

export type PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
export const PRAYERS: { name: PrayerName; time: string }[] = [
  { name: "Fajr", time: "05:15" },
  { name: "Dhuhr", time: "12:30" },
  { name: "Asr", time: "15:45" },
  { name: "Maghrib", time: "18:20" },
  { name: "Isha", time: "19:45" },
];

export type PrayerLog = Record<string, Partial<Record<PrayerName, boolean>>>; // date -> prayer -> done
/** Per-day prayer time overrides fetched from API: date(YYYY-MM-DD) -> name -> "HH:mm". */
export type PrayerTimes = Record<string, Partial<Record<PrayerName, string>>>;

export type NotificationKind =
  | "milestone"
  | "deadline"
  | "block"
  | "prayer"
  | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  createdAt: string;
  /** Optional cross-reference id (e.g. blockId) so dismiss can mutate state. */
  refId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

export type TabKey =
  | "dashboard"
  | "namaz"
  | "todo"
  | "schedule"
  | "analytics"
  | "workbench"
  | "settings";

export interface UserProfile {
  name: string;
  role: string;
  avatarDataUrl?: string;
}

export interface UserMemory {
  notes: string[];
  preferredLanguage?: string;
  workingHours?: string;
}

export type NotificationFrequency = "critical" | "all";
export type AiDepth = "fast" | "deep";

export interface AppSettings {
  notificationFrequency: NotificationFrequency;
  aiDepth: AiDepth;
  aiModel: string;
}

export interface GeoCoords {
  lat: number;
  lon: number;
}

interface AppState {
  activeTab: TabKey;
  setActiveTab: (t: TabKey) => void;

  tasks: Task[];
  addTask: (t: Omit<Task, "id" | "createdAt" | "done">) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;

  blocks: ScheduleBlock[];
  addBlock: (b: Omit<ScheduleBlock, "id">) => void;
  /** Insert a block, trimming/deleting any overlapping same-day blocks. */
  resolveAndAddBlock: (b: Omit<ScheduleBlock, "id">) => string;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, patch: Partial<ScheduleBlock>) => void;

  prayers: PrayerLog;
  togglePrayer: (date: string, name: PrayerName) => void;

  /** Cyber Credits economy. */
  credits: number;
  /** date(YYYY-MM-DD) -> credits earned that day. */
  creditHistory: Record<string, number>;
  /** Bonus payout already granted for a full 5/5 namaz day. */
  namazBonusPaid: Record<string, true>;
  awardCredits: (amount: number, date?: string) => void;
  /** Hardware Armory: purchased part ids (inventory). */
  ownedParts: string[];
  buyPart: (id: string, cost: number) => boolean;
  sellPart: (id: string, refund: number) => void;
  /** Parts currently installed in the rig (one per slot). */
  equippedParts: string[];
  equipPart: (id: string) => void;
  unequipPart: (id: string) => void;

  /** date(YYYY-MM-DD) -> blockIds completed that day. */
  completedBlocks: Record<string, string[]>;
  markBlockDone: (blockId: string, date?: string) => void;
  unmarkBlockDone: (blockId: string, date?: string) => void;

  /** Legacy persisted streak; UI reads derived streak via selectStreak. */
  streak: number;
  lastActiveDate: string | null;
  /** Day key (Date.toDateString()); streak only bumps once per calendar day. */
  lastCompletedDate: string | null;
  bumpStreak: () => void;
  resetAll: () => void;

  /** Focus session (single active at a time). */
  focusTaskId: string | null;
  focusStartedAt: string | null;
  startFocus: (taskId: string) => void;
  endFocus: (opts?: { complete?: boolean }) => void;

  /** Recovery briefings already issued (taskId -> true) to avoid repeats. */
  recoveryBriefed: Record<string, true>;
  markRecoveryBriefed: (taskId: string) => void;

  profile: UserProfile;
  setProfileName: (name: string) => void;
  setProfile: (patch: Partial<UserProfile>) => void;

  memory: UserMemory;
  addMemoryNote: (note: string) => void;
  clearMemoryNotes: () => void;

  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void;

  prayerTimes: PrayerTimes;
  setDayPrayerTimes: (date: string, map: Partial<Record<PrayerName, string>>) => void;

  coords: GeoCoords | null;
  setCoords: (c: GeoCoords | null) => void;

  notifications: AppNotification[];
  pushNotification: (n: Omit<AppNotification, "id" | "createdAt">) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  dispatched: Record<string, true>;
  markDispatched: (key: string) => void;

  bootGreetedSession: string | null;
  markBootGreeted: (sessionId: string) => void;

  /** Per-day fired milestone thresholds, to avoid duplicate notifications. */
  notifiedMilestones: Record<string, number[]>;
  recordMilestone: (date: string, threshold: number) => void;

  openrouterKey: string;
  setOpenrouterKey: (k: string) => void;

  chat: ChatMessage[];
  pushChat: (m: ChatMessage) => void;
  clearChat: () => void;

  sessions: ChatSession[];
  activeSessionId: string;
  newSession: () => string;
  deleteSession: (id: string) => void;
  selectSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  pushToActive: (m: ChatMessage) => void;
  clearActive: () => void;

  notificationsEnabled: boolean;
  setNotificationsEnabled: (b: boolean) => void;

  vizierOpen: boolean;
  setVizierOpen: (b: boolean) => void;

  vizierCollapsed: boolean;
  setVizierCollapsed: (b: boolean) => void;
}

/** Credits awarded when a mission is completed, by priority. */
export const TASK_CREDITS: Record<Priority, number> = {
  critical: 8,
  high: 5,
  medium: 3,
  low: 1,
};
/** Credits awarded when a schedule block is checked off. */
export const BLOCK_CREDITS = 3;
/** Bonus payout for logging all five daily prayers. */
export const NAMAZ_BONUS_CREDITS = 5;

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      activeTab: "dashboard",
      setActiveTab: (t) => set({ activeTab: t }),

      tasks: [
        {
          id: uid(),
          title: "Ship CyberTime Machine v1",
          description: "Polish UI, wire Vizier agent, validate flows.",
          priority: "critical",
          tags: ["build", "launch"],
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          done: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: uid(),
          title: "Deep work: algorithms",
          priority: "high",
          tags: ["study"],
          done: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: uid(),
          title: "Review weekly analytics",
          priority: "medium",
          tags: ["ops"],
          done: true,
          createdAt: new Date().toISOString(),
        },
      ],
      addTask: (t) =>
        set((s) => ({
          tasks: [
            { ...t, id: uid(), createdAt: new Date().toISOString(), done: false },
            ...s.tasks,
          ],
        })),
      toggleTask: (id) =>
        set((s) => {
          const target = s.tasks.find((x) => x.id === id);
          const nextDone = target ? !target.done : false;
          let creditDelta = 0;
          const tasks = s.tasks.map((x) => {
            if (x.id !== id) return x;
            const now = new Date().toISOString();
            if (!x.done) {
              const earned = TASK_CREDITS[x.priority] ?? 1;
              creditDelta += earned;
              return { ...x, done: true, completedAt: now, credits: earned };
            }
            creditDelta -= x.credits ?? 0;
            return { ...x, done: false, completedAt: undefined, credits: undefined };
          });
          const d = today();
          const credits = Math.max(0, s.credits + creditDelta);
          const creditHistory = {
            ...s.creditHistory,
            [d]: Math.max(0, (s.creditHistory[d] ?? 0) + creditDelta),
          };
          if (target && nextDone) {
            const dayKey = new Date().toDateString();
            if (s.lastCompletedDate !== dayKey) {
              return {
                tasks,
                credits,
                creditHistory,
                streak: s.streak + 1,
                lastCompletedDate: dayKey,
                lastActiveDate: today(),
              };
            }
          }
          return { tasks, credits, creditHistory };
        }),
      removeTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id) })),
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),

      blocks: [
        {
          id: uid(),
          title: "Deep Study Block",
          category: "study",
          start: "09:00",
          end: "11:00",
          date: today(),
        },
        {
          id: uid(),
          title: "Client Work",
          category: "work",
          start: "13:00",
          end: "16:00",
          date: today(),
        },
        {
          id: uid(),
          title: "Evening Review",
          category: "rest",
          start: "21:00",
          end: "21:30",
          date: today(),
        },
      ],
      addBlock: (b) => set((s) => ({ blocks: [...s.blocks, { ...b, id: uid() }] })),
      resolveAndAddBlock: (b) => {
        const id = uid();
        set((s) => {
          const dow =
            typeof b.dayOfWeek === "number"
              ? b.dayOfWeek
              : new Date(b.date).getDay();
          const { deleteIds, updates, splitAdditions } = resolveConflicts(
            s.blocks,
            { start: b.start, end: b.end, dayOfWeek: dow },
          );
          const delSet = new Set(deleteIds);
          const nextBlocks: ScheduleBlock[] = s.blocks
            .filter((x) => !delSet.has(x.id))
            .map((x) => (updates[x.id] ? { ...x, ...updates[x.id] } : x));
          nextBlocks.push({ ...b, id, dayOfWeek: dow });
          for (const add of splitAdditions) {
            nextBlocks.push({ ...add, id: uid() });
          }
          return { blocks: nextBlocks };
        });
        return id;
      },
      removeBlock: (id) =>
        set((s) => ({ blocks: s.blocks.filter((x) => x.id !== id) })),
      updateBlock: (id, patch) =>
        set((s) => ({
          blocks: s.blocks.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),

      prayers: {},
      togglePrayer: (date, name) =>
        set((s) => {
          const day = { ...(s.prayers[date] ?? {}) };
          day[name] = !day[name];
          const prayers = { ...s.prayers, [date]: day };
          const complete = PRAYERS.every((p) => day[p.name]);
          if (complete && !s.namazBonusPaid[date]) {
            return {
              prayers,
              credits: s.credits + NAMAZ_BONUS_CREDITS,
              creditHistory: {
                ...s.creditHistory,
                [date]: (s.creditHistory[date] ?? 0) + NAMAZ_BONUS_CREDITS,
              },
              namazBonusPaid: { ...s.namazBonusPaid, [date]: true as const },
            };
          }
          return { prayers };
        }),

      credits: 0,
      creditHistory: {},
      namazBonusPaid: {},
      awardCredits: (amount, date) =>
        set((s) => {
          const d = date ?? today();
          return {
            credits: Math.max(0, s.credits + amount),
            creditHistory: {
              ...s.creditHistory,
              [d]: Math.max(0, (s.creditHistory[d] ?? 0) + amount),
            },
          };
        }),
      ownedParts: [],
      buyPart: (id, cost) => {
        const s = get();
        if (s.ownedParts.includes(id) || s.credits < cost) return false;
        set({ credits: s.credits - cost, ownedParts: [...s.ownedParts, id] });
        return true;
      },
      sellPart: (id, refund) =>
        set((s) => ({
          ownedParts: s.ownedParts.filter((x) => x !== id),
          equippedParts: s.equippedParts.filter((x) => x !== id),
          credits: s.credits + refund,
        })),
      equippedParts: [],
      equipPart: (id) =>
        set((s) => {
          const part = partById(id);
          if (!part || !s.ownedParts.includes(id) || s.equippedParts.includes(id)) return s;
          // One part per slot: unequip any other part occupying the same slot.
          const sameSlot = new Set(
            s.equippedParts.filter((eid) => partById(eid)?.slot === part.slot),
          );
          return {
            equippedParts: [...s.equippedParts.filter((eid) => !sameSlot.has(eid)), id],
          };
        }),
      unequipPart: (id) =>
        set((s) => ({ equippedParts: s.equippedParts.filter((x) => x !== id) })),

      completedBlocks: {},
      markBlockDone: (blockId, date) =>
        set((s) => {
          const d = date ?? today();
          const cur = s.completedBlocks[d] ?? [];
          if (cur.includes(blockId)) return s;
          const dayKey = new Date().toDateString();
          const bumped =
            s.lastCompletedDate === dayKey
              ? {}
              : { streak: s.streak + 1, lastCompletedDate: dayKey, lastActiveDate: d };
          return {
            completedBlocks: { ...s.completedBlocks, [d]: [...cur, blockId] },
            credits: s.credits + BLOCK_CREDITS,
            creditHistory: {
              ...s.creditHistory,
              [d]: (s.creditHistory[d] ?? 0) + BLOCK_CREDITS,
            },
            ...bumped,
          };
        }),
      unmarkBlockDone: (blockId, date) =>
        set((s) => {
          const d = date ?? today();
          const cur = s.completedBlocks[d] ?? [];
          if (!cur.includes(blockId)) return s;
          return {
            completedBlocks: {
              ...s.completedBlocks,
              [d]: cur.filter((x) => x !== blockId),
            },
            credits: Math.max(0, s.credits - BLOCK_CREDITS),
            creditHistory: {
              ...s.creditHistory,
              [d]: Math.max(0, (s.creditHistory[d] ?? 0) - BLOCK_CREDITS),
            },
          };
        }),

      streak: 0,
      lastActiveDate: null,
      lastCompletedDate: null,
      bumpStreak: () => {
        const dayKey = new Date().toDateString();
        const { lastCompletedDate, streak } = get();
        if (lastCompletedDate === dayKey) return;
        set({ streak: streak + 1, lastCompletedDate: dayKey, lastActiveDate: today() });
      },

      resetAll: () => {
        try {
          localStorage.removeItem("cybertime-machine-v1");
          localStorage.clear();
        } catch {
          /* ignore */
        }
        if (typeof window !== "undefined") window.location.reload();
      },

      focusTaskId: null,
      focusStartedAt: null,
      startFocus: (taskId) =>
        set((s) => {
          const task = s.tasks.find((x) => x.id === taskId);
          if (!task) return s;
          return {
            focusTaskId: taskId,
            focusStartedAt: new Date().toISOString(),
            tasks: s.tasks.map((x) =>
              x.id === taskId ? { ...x, initiatedAt: new Date().toISOString() } : x,
            ),
          };
        }),
      endFocus: (opts) =>
        set((s) => {
          if (!s.focusTaskId || !s.focusStartedAt) {
            return { focusTaskId: null, focusStartedAt: null };
          }
          const elapsedMin = Math.max(
            0,
            Math.round((Date.now() - new Date(s.focusStartedAt).getTime()) / 60000),
          );
          const tid = s.focusTaskId;
          const tasks = s.tasks.map((x) => {
            if (x.id !== tid) return x;
            const nextActual = (x.actualMinutes ?? 0) + elapsedMin;
            if (opts?.complete && !x.done) {
              return {
                ...x,
                actualMinutes: nextActual,
                done: true,
                completedAt: new Date().toISOString(),
                credits: TASK_CREDITS[x.priority] ?? 1,
              };
            }
            return { ...x, actualMinutes: nextActual };
          });
          const completedNow = opts?.complete;
          const earned = completedNow
            ? (tasks.find((x) => x.id === tid)?.credits ?? 0) -
              (s.tasks.find((x) => x.id === tid)?.credits ?? 0)
            : 0;
          const d = today();
          return {
            focusTaskId: null,
            focusStartedAt: null,
            tasks,
            credits: s.credits + earned,
            creditHistory: earned
              ? { ...s.creditHistory, [d]: (s.creditHistory[d] ?? 0) + earned }
              : s.creditHistory,
          };
        }),

      recoveryBriefed: {},
      markRecoveryBriefed: (taskId) =>
        set((s) =>
          s.recoveryBriefed[taskId]
            ? s
            : { recoveryBriefed: { ...s.recoveryBriefed, [taskId]: true } },
        ),

      profile: { name: "CyberVizier", role: "AI Engineer / Digital Creator" },
      setProfileName: (name) => set((s) => ({ profile: { ...s.profile, name } })),
      setProfile: (patch: Partial<UserProfile>) =>
        set((s) => ({ profile: { ...s.profile, ...patch } })),

      memory: { notes: [] },
      addMemoryNote: (note) =>
        set((s) => ({
          memory: { ...s.memory, notes: [note, ...s.memory.notes].slice(0, 40) },
        })),
      clearMemoryNotes: () => set((s) => ({ memory: { ...s.memory, notes: [] } })),

      settings: {
        notificationFrequency: "critical",
        aiDepth: "fast",
        aiModel: "openrouter/auto",
      },
      setSetting: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),

      prayerTimes: {},
      setDayPrayerTimes: (date, map) =>
        set((s) => ({
          prayerTimes: {
            ...s.prayerTimes,
            [date]: { ...(s.prayerTimes[date] ?? {}), ...map },
          },
        })),

      // Default to Karachi, PK until the operator enables live geolocation.
      coords: { lat: 24.8607, lon: 67.0011 },
      setCoords: (c) => set({ coords: c }),

      notifications: [],
      pushNotification: (n) =>
        set((s) => ({
          notifications: [
            {
              ...n,
              id: uid(),
              createdAt: new Date().toISOString(),
            },
            ...s.notifications,
          ].slice(0, 50),
        })),
      dismissNotification: (id) =>
        set((s) => ({ notifications: s.notifications.filter((x) => x.id !== id) })),
      clearNotifications: () => set({ notifications: [] }),
      dispatched: {},
      markDispatched: (key) =>
        set((s) =>
          s.dispatched[key] ? s : { dispatched: { ...s.dispatched, [key]: true } },
        ),

      bootGreetedSession: null,
      markBootGreeted: (sessionId) => set({ bootGreetedSession: sessionId }),

      notifiedMilestones: {},
      recordMilestone: (date, threshold) =>
        set((s) => {
          const day = s.notifiedMilestones[date] ?? [];
          if (day.includes(threshold)) return s;
          return {
            notifiedMilestones: {
              ...s.notifiedMilestones,
              [date]: [...day, threshold],
            },
          };
        }),

      openrouterKey: "",
      setOpenrouterKey: (k) => set({ openrouterKey: k }),

      chat: [
        {
          id: uid(),
          role: "assistant",
          content:
            "I am the Vizier. State your objective. I will enforce your schedule with absolute discipline.",
          createdAt: new Date().toISOString(),
        },
      ],
      pushChat: (m) => set((s) => ({ chat: [...s.chat, m] })),
      clearChat: () => set({ chat: [] }),

      ...(() => {
        const sid = uid();
        return {
          sessions: [
            {
              id: sid,
              title: "Today's Focus",
              updatedAt: new Date().toISOString(),
              messages: [
                {
                  id: uid(),
                  role: "assistant" as const,
                  content:
                    "I am the Vizier. State your objective. I will enforce your schedule with absolute discipline.",
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          ],
          activeSessionId: sid,
        };
      })(),
      newSession: () => {
        const id = uid();
        const session: ChatSession = {
          id,
          title: "New Directive",
          updatedAt: new Date().toISOString(),
          messages: [
            {
              id: uid(),
              role: "assistant",
              content: "Fresh channel open. State the objective.",
              createdAt: new Date().toISOString(),
            },
          ],
        };
        set((s) => ({ sessions: [session, ...s.sessions], activeSessionId: id }));
        return id;
      },
      deleteSession: (id) =>
        set((s) => {
          const rest = s.sessions.filter((x) => x.id !== id);
          const active =
            s.activeSessionId === id ? rest[0]?.id ?? "" : s.activeSessionId;
          return { sessions: rest, activeSessionId: active };
        }),
      selectSession: (id) => set({ activeSessionId: id }),
      renameSession: (id, title) =>
        set((s) => ({
          sessions: s.sessions.map((x) => (x.id === id ? { ...x, title } : x)),
        })),
      pushToActive: (m) =>
        set((s) => {
          const aid = s.activeSessionId || s.sessions[0]?.id;
          if (!aid) return s;
          return {
            sessions: s.sessions.map((x) =>
              x.id === aid
                ? {
                    ...x,
                    messages: [...x.messages, m],
                    updatedAt: new Date().toISOString(),
                    title:
                      x.messages.filter((mm) => mm.role === "user").length === 0 &&
                      m.role === "user"
                        ? m.content.slice(0, 40)
                        : x.title,
                  }
                : x,
            ),
          };
        }),
      clearActive: () =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === s.activeSessionId ? { ...x, messages: [] } : x,
          ),
        })),

      notificationsEnabled: false,
      setNotificationsEnabled: (b) => set({ notificationsEnabled: b }),

      vizierOpen: false,
      setVizierOpen: (b) => set({ vizierOpen: b }),

      vizierCollapsed: false,
      setVizierCollapsed: (b: boolean) => set({ vizierCollapsed: b }),
    }),
    {
      name: "cybertime-machine-v1",
      version: 8,
      migrate: (state: unknown) => {
        const s = (state ?? {}) as Record<string, unknown>;
        // v7: OpenRouter key rename (client-side only, never committed).
        if (typeof s.geminiKey === "string" && typeof s.openrouterKey !== "string") {
          s.openrouterKey = s.geminiKey;
        }
        delete s.geminiKey;
        // v8: split purchased inventory from equipped rig parts — existing owners
        // get their first owned part per slot equipped automatically.
        if (!Array.isArray(s.equippedParts)) {
          const owned = Array.isArray(s.ownedParts) ? (s.ownedParts as string[]) : [];
          const seen = new Set<string>();
          s.equippedParts = owned.filter((id) => {
            const p = partById(id);
            if (!p || seen.has(p.slot)) return false;
            seen.add(p.slot);
            return true;
          });
        }
        if (typeof s.credits !== "number") s.credits = 0;
        if (!s.creditHistory || typeof s.creditHistory !== "object") s.creditHistory = {};
        if (!s.namazBonusPaid || typeof s.namazBonusPaid !== "object") s.namazBonusPaid = {};
        if (!Array.isArray(s.ownedParts)) s.ownedParts = [];
        if (Array.isArray(s.tasks)) {
          s.tasks = (s.tasks as Record<string, unknown>[]).map(({ xp: _xp, ...t }) => t);
        }
        if (!s.settings || typeof s.settings !== "object") {
          s.settings = { notificationFrequency: "critical", aiDepth: "fast", aiModel: "openrouter/auto" };
        } else {
          const cur = s.settings as Record<string, unknown>;
          if (!cur.aiModel || cur.aiModel === "google/gemini-pro-1.5") cur.aiModel = "openrouter/auto";
        }
        delete s.pomodoro;
        if (!s.prayerTimes) s.prayerTimes = {};
        if (s.coords === undefined) s.coords = null;
        if (!Array.isArray(s.notifications)) s.notifications = [];
        if (!s.dispatched) s.dispatched = {};
        // Migrate ScheduleBlocks: add dayOfWeek derived from date.
        if (Array.isArray(s.blocks)) {
          s.blocks = (s.blocks as ScheduleBlock[]).map((b) => ({
            ...b,
            dayOfWeek: b.dayOfWeek ?? (b.date ? new Date(b.date).getDay() : 1),
          }));
        }
        if (!s.completedBlocks || typeof s.completedBlocks !== "object") {
          s.completedBlocks = {};
        }
        if (s.lastCompletedDate === undefined) s.lastCompletedDate = null;
        if (!s.recoveryBriefed || typeof s.recoveryBriefed !== "object") {
          s.recoveryBriefed = {};
        }
        if (s.focusTaskId === undefined) s.focusTaskId = null;
        if (s.focusStartedAt === undefined) s.focusStartedAt = null;
        return s;
      },
    },
  ),
);

export const newId = uid;
export const todayStr = today;
