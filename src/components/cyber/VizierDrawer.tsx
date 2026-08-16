import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Sparkles,
  Plus,
  Trash2,
  MessageSquare,
  History,
  ChevronsRight,
  AlertTriangle,
  Paperclip,
  X,
} from "lucide-react";
import { useApp, newId, todayStr, type PrayerName, type TabKey } from "@/lib/store";
import { buildContext, callVizier, type VizierAction, type VizierAttachment } from "@/lib/ai-core";
import { tryHandleSlash } from "@/lib/slashCommands";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatTime12, to12h, tzName } from "@/lib/clock";

/** JARVIS-style arc reactor HUD (pure CSS spinning rings — zero GPU cost). */
function ArcReactor({ size = 48 }: { size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      <div
        className="absolute inset-0 animate-[holo-spin_6s_linear_infinite] rounded-full border-2 border-[oklch(0.85_0.17_200/0.3)]"
        style={{ borderTopColor: "var(--holo-cyan)", borderRightColor: "transparent" }}
      />
      <div
        className="absolute inset-[14%] animate-[holo-spin-rev_4.2s_linear_infinite] rounded-full border border-[oklch(0.66_0.27_295/0.45)]"
        style={{ borderBottomColor: "var(--holo-violet)", borderTopColor: "transparent" }}
      />
      <div
        className="absolute inset-[30%] animate-[holo-spin_3s_linear_infinite] rounded-full border border-[oklch(0.82_0.16_80/0.45)]"
        style={{ borderLeftColor: "var(--holo-amber)", borderRightColor: "transparent" }}
      />
      <div className="absolute inset-[42%] animate-[reactor-core_2.2s_ease-in-out_infinite] rounded-full bg-[var(--holo-cyan)] shadow-[0_0_14px_var(--holo-cyan)]" />
    </div>
  );
}

export function VizierDrawer() {
  const {
    vizierCollapsed,
    setVizierCollapsed,
    tasks,
    blocks,
    prayers,
    addTask,
    resolveAndAddBlock,
    removeTask,
    removeBlock,
    updateBlock,
    setActiveTab,
    togglePrayer,
    updateTask,
    sessions,
    activeSessionId,
    newSession,
    deleteSession,
    selectSession,
    pushToActive,
    profile,
    memory,
    addMemoryNote,
    settings,
    credits,
    bootGreetedSession,
    markBootGreeted,
  } = useApp();
  const openrouterKey = useApp((s) => s.openrouterKey);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [attachments, setAttachments] = useState<VizierAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0],
    [sessions, activeSessionId],
  );
  const chat = active?.messages ?? [];

  // Overdue tasks (live).
  const overdue = useMemo(() => {
    const now = Date.now();
    return tasks.filter(
      (t) => !t.done && t.dueDate && new Date(t.dueDate).getTime() < now,
    );
  }, [tasks]);

  // Proactive boot greeting — once per session.
  useEffect(() => {
    if (!active) return;
    if (bootGreetedSession === active.id) return;
    const userMsgs = active.messages.filter((m) => m.role === "user").length;
    if (userMsgs > 0) {
      markBootGreeted(active.id);
      return;
    }
    const now = new Date();
    const today = todayStr();
    const mins = now.getHours() * 60 + now.getMinutes();
    const upcoming = blocks
      .filter((b) => b.date === today)
      .map((b) => {
        const [h, m] = b.start.split(":").map(Number);
        return { ...b, mins: h * 60 + m };
      })
      .filter((b) => b.mins >= mins)
      .sort((a, b) => a.mins - b.mins)[0];
    const nextLine = upcoming
      ? `Next on deck: ${upcoming.title} at ${to12h(upcoming.start)}.`
      : "No further blocks scheduled today — open territory.";
    const overdueLine = overdue.length
      ? ` Flagging ${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"} — top: "${overdue[0].title}".`
      : "";
    const greet = `Standing by, ${profile.name}. It is ${formatTime12(now, false)} (${tzName()}). ${nextLine}${overdueLine} State your objective.`;
    pushToActive({
      id: newId(),
      role: "assistant",
      content: greet,
      createdAt: new Date().toISOString(),
    });
    markBootGreeted(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // Smooth scroll to the newest message; instant jump when switching sessions
  // so the operator sees the tail of any old chat immediately (no top-freeze).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [activeSessionId]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.length, busy]);

  const runAction = (a: VizierAction) => {
    const p = a.payload ?? {};
    try {
      switch (a.type) {
        case "add_task":
          addTask({
            title: String(p.title ?? "Untitled"),
            description: p.description ? String(p.description) : undefined,
            priority: (p.priority as "low" | "medium" | "high" | "critical") ?? "medium",
            tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
            dueDate: p.dueDate ? String(p.dueDate) : undefined,
          });
          addMemoryNote(`Task added via Vizier: ${p.title}`);
          toast.success(`Task added: ${p.title}`);
          setActiveTab("todo");
          break;
        case "add_block":
          resolveAndAddBlock({
            title: String(p.title ?? "Block"),
            category: (p.category as "study" | "work" | "rest" | "prayer" | "other") ?? "work",
            start: String(p.start ?? "09:00"),
            end: String(p.end ?? "10:00"),
            date: String(p.date ?? todayStr()),
            dayOfWeek:
              typeof p.dayOfWeek === "number"
                ? (p.dayOfWeek as number)
                : new Date().getDay(),
          });
          addMemoryNote(`Block scheduled via Vizier: ${p.title} ${p.start}-${p.end}`);
          toast.success(`Block scheduled: ${p.title} (overlaps resolved)`);
          setActiveTab("schedule");
          break;
        case "switch_tab":
          setActiveTab((p.tab as TabKey) ?? "dashboard");
          break;
        case "toggle_prayer":
          togglePrayer(String(p.date ?? todayStr()), (p.name as PrayerName) ?? "Fajr");
          setActiveTab("namaz");
          break;
        case "complete_task": {
          const match = String(p.match ?? "").toLowerCase();
          const t = tasks.find((x) => x.title.toLowerCase().includes(match));
          if (t) updateTask(t.id, { done: true });
          setActiveTab("todo");
          break;
        }
        case "update_task": {
          const match = String(p.match ?? "").toLowerCase();
          const t = tasks.find((x) => x.title.toLowerCase().includes(match));
          if (t && p.patch && typeof p.patch === "object") {
            updateTask(t.id, p.patch as Record<string, unknown>);
          }
          setActiveTab("todo");
          break;
        }
        case "delete_task": {
          const match = String(p.match ?? "").toLowerCase();
          const t = tasks.find((x) => x.title.toLowerCase().includes(match));
          if (t) removeTask(t.id);
          setActiveTab("todo");
          break;
        }
        case "update_block": {
          const match = String(p.match ?? "").toLowerCase();
          const b = blocks.find((x) => x.title.toLowerCase().includes(match));
          if (b && p.patch && typeof p.patch === "object") {
            updateBlock(b.id, p.patch as Record<string, unknown>);
          }
          setActiveTab("schedule");
          break;
        }
        case "delete_block": {
          const match = String(p.match ?? "").toLowerCase();
          const b = blocks.find((x) => x.title.toLowerCase().includes(match));
          if (b) removeBlock(b.id);
          setActiveTab("schedule");
          break;
        }
        case "dedupe_tasks": {
          const seen = new Set<string>();
          for (const t of [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
            const k = t.title.trim().toLowerCase();
            if (seen.has(k)) removeTask(t.id);
            else seen.add(k);
          }
          setActiveTab("todo");
          break;
        }
        case "remember": {
          if (p.note) addMemoryNote(String(p.note));
          toast.success("Memory updated.");
          break;
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const attachFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: only images supported`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        setAttachments((a) => [...a, { dataUrl, mimeType: f.type, name: f.name }]);
      };
      reader.readAsDataURL(f);
    });
  };

  const sendText = async (text: string) => {
    if (!text || busy) return;
    // Slash-command interceptor: execute locally, no round-trip.
    const slash = tryHandleSlash(text);
    if (slash) {
      pushToActive({
        id: newId(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      });
      pushToActive({
        id: newId(),
        role: "assistant",
        content: `${slash.ok ? "✓" : "⚠"} ${slash.message}`,
        createdAt: new Date().toISOString(),
      });
      if (slash.ok) toast.success(slash.message);
      else toast.error(slash.message);
      return;
    }
    pushToActive({
      id: newId(),
      role: "user",
      content:
        text + (attachments.length ? ` [+${attachments.length} image${attachments.length > 1 ? "s" : ""}]` : ""),
      createdAt: new Date().toISOString(),
    });
    const sentAttachments = attachments;
    setAttachments([]);
    setBusy(true);
    try {
      const now = new Date();
      // Pull LIVE state — never use stale closure data so deletes/updates
      // propagate to the AI on the very next message.
      const live = useApp.getState();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const todayBlocks = live.blocks
        .filter((b) => {
          const dow = typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
          return dow === now.getDay();
        })
        .map((b) => {
          const [sh, sm] = b.start.split(":").map(Number);
          const [eh, em] = b.end.split(":").map(Number);
          return { b, sMins: sh * 60 + sm, eMins: eh * 60 + em };
        })
        .sort((a, z) => a.sMins - z.sMins);
      const activeNow = todayBlocks.find((x) => nowMins >= x.sMins && nowMins < x.eMins)?.b;
      const nextUp = todayBlocks.find((x) => x.sMins >= nowMins)?.b;
      const ctx = buildContext({
        operator: profile.name,
        nowLocal: formatTime12(now),
        nowISO: now.toISOString(),
        weekday: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()],
        timezone: tzName(),
        today: todayStr(),
        app: "CyberTime Machine",
        tabs: ["dashboard", "namaz", "todo", "schedule", "analytics"],
        activeBlockNow: activeNow
          ? { title: activeNow.title, start12: to12h(activeNow.start), end12: to12h(activeNow.end) }
          : null,
        nextBlock: nextUp
          ? { title: nextUp.title, start12: to12h(nextUp.start), end12: to12h(nextUp.end) }
          : null,
        tasks: live.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          done: t.done,
          due: t.dueDate,
          tags: t.tags,
        })),
        blocksToday: live.blocks.filter((b) => {
          const dow = typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
          return dow === now.getDay();
        }).map((b) => ({
          id: b.id,
          title: b.title,
          category: b.category,
          start12: to12h(b.start),
          end12: to12h(b.end),
        })),
        allBlocks: live.blocks.map((b) => ({
          id: b.id,
          title: b.title,
          dayOfWeek: typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay(),
          start12: to12h(b.start),
          end12: to12h(b.end),
        })),
        prayersToday: live.prayers[todayStr()] ?? {},
        prayerTimesToday: live.prayerTimes[todayStr()] ?? {},
        completedBlocksToday: live.completedBlocks?.[todayStr()] ?? [],
        memoryNotes: live.memory.notes.slice(0, 12),
      });
      const session =
        live.sessions.find((s) => s.id === live.activeSessionId) ??
        live.sessions[0];
      const history = session?.messages ?? [];
      const reply = await callVizier(history, ctx, settings.aiModel, {
        maxTokens: settings.aiDepth === "deep" ? 1400 : 700,
        temperature: settings.aiDepth === "deep" ? 0.7 : 0.55,
        attachments: sentAttachments.length ? sentAttachments : undefined,
        memoryNotes: live.memory.notes,
      });
      // Apply actions to state FIRST so the UI updates before the message renders.
      reply.actions.forEach(runAction);
      // Heuristic memory capture: explicit "remember…" pattern
      let captured: string | null = null;
      const m = text.match(/remember(?:\s+that)?[:,]?\s+(.{4,160})/i);
      if (m) {
        captured = m[1].trim();
        addMemoryNote(captured);
      }
      const taggedMsg =
        captured && !reply.message.includes("Updated Memory")
          ? `${reply.message}\n\n[System Alert: Updated Memory 🧠] ${captured}`
          : reply.message;
      pushToActive({
        id: newId(),
        role: "assistant",
        content: taggedMsg,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      pushToActive({
        id: newId(),
        role: "assistant",
        content: `System fault: ${msg}`,
        createdAt: new Date().toISOString(),
      });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendText(text);
  };

  const quickContext = async () => {
    const total = tasks.length || 1;
    const done = tasks.filter((t) => t.done).length;
    const pct = Math.round((done / total) * 100);
    const todayP = prayers[todayStr()] ?? {};
    const prayerDone = Object.values(todayP).filter(Boolean).length;
    const summary = `QUICK CONTEXT BRIEF — Daily progress: ${pct}% (${done}/${tasks.length} tasks). Namaz today: ${prayerDone}/5. Open blocks: ${blocks.length}. Give a tactical assessment and the single next move I must execute now.`;
    setInput("");
    await sendText(summary);
  };

  // Quick Directive Chips — one-tap directives into the Vizier channel.
  const quickDirectives: { label: string; run: () => void }[] = [
    { label: "Analyze System Status", run: quickContext },
    {
      label: "Equip Best Available GPU",
      run: () =>
        sendText(
          "Recommend the best GPU in the Armory I can afford with my current credits and tell me how equipping it changes my rig.",
        ),
    },
    { label: "Add Study Block at 4 PM", run: () => sendText("/add Study block at 4 PM-6 PM") },
    {
      label: "Clear Overdue Backlog",
      run: () =>
        sendText(
          `Clear my overdue backlog. Reschedule or close these: ${overdue
            .map((t) => t.title)
            .join(", ")}. Use add_block / complete_task actions.`,
        ),
    },
    {
      label: "Optimize Today's Schedule",
      run: () =>
        sendText(
          "Optimize my schedule for the rest of today. Suggest add_block actions to recover lost time.",
        ),
    },
  ];

  if (vizierCollapsed) {
    return (
      <aside className="fixed right-0 top-0 z-30 flex h-full w-14 flex-col items-center gap-3 border-l border-[oklch(0.85_0.17_200/0.2)] bg-[oklch(0.085_0.02_270/0.94)] py-3 backdrop-blur-xl">
        <button
          onClick={() => setVizierCollapsed(false)}
          className="relative flex size-10 items-center justify-center rounded-full border border-[oklch(0.85_0.17_200/0.4)] bg-[oklch(0.85_0.17_200/0.1)] text-[var(--holo-cyan)]"
          title="Expand Vizier"
        >
          <span className="pointer-events-none absolute -inset-[3px] animate-[holo-spin_4s_linear_infinite] rounded-full border border-dashed border-[oklch(0.85_0.17_200/0.5)]" />
          <Bot className="size-5" />
        </button>
        {overdue.length > 0 && (
          <div className="mt-1 rounded-full bg-[var(--holo-pink)]/20 px-1.5 py-0.5 text-[10px] font-mono text-[var(--holo-pink)]">
            !{overdue.length}
          </div>
        )}
      </aside>
    );
  }

  const quickPrompt = async (prompt: string) => {
    await sendText(prompt);
  };

  return (
    <>
      <aside className="fixed right-0 top-0 z-30 flex h-full w-[380px] flex-col border-l border-[oklch(0.85_0.17_200/0.22)] bg-[oklch(0.085_0.02_270/0.94)] backdrop-blur-xl">
        {/* Tactical AI Core header */}
        <div className="relative border-b border-[oklch(0.85_0.17_200/0.15)] px-5 pb-3 pt-4">
          <div className="relative flex items-center gap-3">
            <ArcReactor />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--holo-cyan)]">
                AI Chief of Staff // Core Online
              </div>
              <div className="truncate text-base font-bold tracking-wide text-foreground">
                {active?.title ?? "THE VIZIER"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                title="History"
                onClick={() => setHistoryOpen((v) => !v)}
                className={cn(historyOpen && "text-[var(--holo-cyan)]")}
              >
                <History className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="New chat"
                onClick={() => {
                  newSession();
                  setHistoryOpen(false);
                }}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Collapse"
                onClick={() => setVizierCollapsed(true)}
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
          {/* Glowing banner */}
          <div className="relative mt-3 flex items-center gap-2 rounded-sm border border-[oklch(0.8_0.16_155/0.35)] bg-[oklch(0.8_0.16_155/0.07)] px-2.5 py-1.5">
            <span className="led-dot" style={{ color: "var(--holo-green)" }} />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--holo-green)]">
              Tactical Advisor Online
            </span>
            <span
              className="ml-auto font-mono text-[9px] text-muted-foreground"
              suppressHydrationWarning
            >
              {mounted ? formatTime12(new Date()) : ""}
            </span>
          </div>
          {/* Dynamic telemetry readouts */}
          <div className="relative mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>
              Missions open <b className="text-[var(--holo-cyan)]">{tasks.filter((t) => !t.done).length}</b>
            </span>
            <span>
              Credits <b className="text-[var(--holo-amber)]">{credits}</b>
            </span>
            <span>
              Channel <b className="text-[var(--holo-violet)]">{chat.length}</b>
            </span>
            <span className="ml-auto text-[var(--holo-green)]">Core ▮▮▮▯</span>
          </div>
        </div>

        {historyOpen && (
          <div className="border-b border-border bg-background/40 max-h-64 overflow-y-auto">
            <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <MessageSquare className="size-3" /> Sessions ({sessions.length})
            </div>
            <ul className="pb-2">
              {sessions.map((s) => {
                const isActive = s.id === active?.id;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "group mx-2 mb-1 flex items-center gap-2 rounded-md border px-2 py-2 text-sm cursor-pointer transition",
                      isActive
                        ? "border-[var(--holo-cyan)]/40 bg-[oklch(0.85_0.2_200_/_0.1)]"
                        : "border-border hover:border-[var(--holo-violet)]/40",
                    )}
                    onClick={() => {
                      selectSession(s.id);
                      setHistoryOpen(false);
                    }}
                  >
                    <MessageSquare className="size-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-xs font-medium">{s.title}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {s.messages.length} msgs
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (sessions.length === 1) {
                          toast.error("Cannot delete the last session.");
                          return;
                        }
                        deleteSession(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[var(--holo-pink)] transition"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div ref={scrollRef} className="scroll-y-clean flex-1 min-h-0 px-5 py-4 space-y-4">
          {mounted && overdue.length > 0 && (
            <div className="rounded-md border border-[var(--holo-pink)]/40 bg-[var(--holo-pink)]/5 p-3 text-xs">
              <div className="mb-2 flex items-center gap-1.5 text-[var(--holo-pink)] font-semibold">
                <AlertTriangle className="size-3.5" />
                {overdue.length} overdue {overdue.length === 1 ? "task" : "tasks"} detected
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() =>
                    quickPrompt(
                      `Clear my overdue backlog. Reschedule or close these: ${overdue.map((t) => t.title).join(", ")}. Use add_block / complete_task actions.`,
                    )
                  }
                  className="rounded border border-border bg-background/60 px-2 py-1 text-[11px] hover:border-[var(--holo-cyan)]/50 transition"
                >
                  Clear Backlog
                </button>
                <button
                  onClick={() => quickPrompt("Optimize my schedule for the rest of today. Suggest add_block actions to recover lost time.")}
                  className="rounded border border-border bg-background/60 px-2 py-1 text-[11px] hover:border-[var(--holo-cyan)]/50 transition"
                >
                  Optimize Schedule
                </button>
                <button
                  onClick={() =>
                    quickPrompt(
                      `Reschedule each of these overdue tasks to a sensible block today or tomorrow: ${overdue.map((t) => t.title).join(", ")}.`,
                    )
                  }
                  className="rounded border border-border bg-background/60 px-2 py-1 text-[11px] hover:border-[var(--holo-cyan)]/50 transition"
                >
                  Reschedule Overdue
                </button>
              </div>
            </div>
          )}
          {mounted && chat.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "holo-panel max-w-[88%] px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                  m.role === "user"
                    ? "border-[oklch(0.66_0.27_295/0.45)] bg-[oklch(0.66_0.27_295/0.08)]"
                    : "border-[oklch(0.85_0.17_200/0.28)]",
                )}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em]">
                  {m.role === "assistant" ? (
                    <>
                      <Sparkles className="size-3 text-[var(--holo-cyan)]" />
                      <span className="text-[var(--holo-cyan)]">Vizier</span>
                    </>
                  ) : (
                    <span className="text-[var(--holo-violet)]">You</span>
                  )}
                  <span
                    className="ml-auto font-mono text-[8.5px] tracking-normal text-[oklch(0.85_0.17_200/0.55)]"
                    suppressHydrationWarning
                  >
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--holo-cyan)]">
              <span className="flex gap-1">
                <span className="size-1.5 animate-[holo-pulse_1s_ease-in-out_infinite] rounded-full bg-[var(--holo-cyan)]" />
                <span className="size-1.5 animate-[holo-pulse_1s_ease-in-out_infinite] rounded-full bg-[var(--holo-cyan)]" style={{ animationDelay: "0.2s" }} />
                <span className="size-1.5 animate-[holo-pulse_1s_ease-in-out_infinite] rounded-full bg-[var(--holo-cyan)]" style={{ animationDelay: "0.4s" }} />
              </span>
              Vizier processing
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[oklch(0.85_0.17_200/0.15)] bg-black/30 p-3">
          {!openrouterKey && !(import.meta.env.VITE_OPENROUTER_API_KEY) && (
            <div className="mb-2 rounded border border-[oklch(0.72_0.28_350_/_0.4)] bg-[oklch(0.72_0.28_350_/_0.1)] px-2 py-1 text-[11px] text-[var(--holo-pink)]">
              No OpenRouter key set — add one in System Core. It stays in your browser.
            </div>
          )}
          {/* Quick Directive Chips */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {quickDirectives.map((c) => (
              <button
                key={c.label}
                disabled={busy}
                onClick={c.run}
                className="clip-angular border border-[oklch(0.85_0.17_200/0.25)] bg-[oklch(0.85_0.17_200/0.06)] px-2 py-1 text-[10px] font-medium text-[var(--holo-cyan)] transition hover:bg-[oklch(0.85_0.17_200/0.15)] disabled:opacity-50"
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="mb-2 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                attachFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              title="Attach image"
              className="border-[oklch(0.85_0.17_200/0.2)] bg-[oklch(0.85_0.17_200/0.05)]"
            >
              <Paperclip className="size-3.5 text-[var(--holo-cyan)]" />
            </Button>
            {attachments.length > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--holo-cyan)]">
                +{attachments.length} image{attachments.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((a, i) => (
                <div
                  key={i}
                  className="relative h-12 w-12 overflow-hidden rounded border border-border"
                >
                  <img src={a.dataUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setAttachments((s) => s.filter((_, j) => j !== i))}
                    className="absolute top-0 right-0 rounded-bl bg-background/80 p-0.5 text-[var(--holo-pink)]"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Issue Directive to Vizier…"
              className="resize-none border-[oklch(0.85_0.17_200/0.25)] bg-black/40 focus:border-[var(--holo-cyan)]"
            />
            <Button
              onClick={send}
              disabled={busy}
              className="clip-angular shrink-0 self-end bg-[oklch(0.85_0.17_200/0.9)] font-bold tracking-wider text-black hover:bg-[var(--holo-cyan)]"
            >
              EXECUTE <span className="font-mono">[⏎]</span>
            </Button>
          </div>
          <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
            ⏎ send · shift+⏎ newline
          </div>
        </div>
      </aside>
    </>
  );
}