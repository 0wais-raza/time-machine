import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import {
  Bot,
  Sparkles,
  Plus,
  Trash2,
  MessageSquare,
  AlertTriangle,
  Paperclip,
  X,
  ChevronRight,
  Coins,
} from "lucide-react";
import { useApp, newId, todayStr, type PrayerName, type TabKey } from "@/lib/store";
import { buildContext, callVizier, type VizierAction, type VizierAttachment } from "@/lib/ai-core";
import { tryHandleSlash } from "@/lib/slashCommands";
import { CATALOG, partById } from "@/lib/hardware";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatTime12, to12h, tzName } from "@/lib/clock";
import { resolveDayTimes } from "@/lib/prayerResolve";

/** JARVIS arc reactor — pure CSS spinning rings (zero GPU cost). */
export function ArcReactor({ size = 48 }: { size?: number }) {
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

/** JARVIS voice-wave equalizer — GSAP-animated bars that intensify when active. */
function VoiceWave({ active, bars = 22 }: { active: boolean; bars?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const nodes = Array.from(el.children) as HTMLElement[];
      const tween = gsap.to(nodes, {
        scaleY: () => gsap.utils.random(0.12, active ? 1 : 0.5),
        duration: () => gsap.utils.random(0.18, 0.42),
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: { each: 0.02, from: "random" },
      });
      return () => {
        tween.kill();
      };
    }, el);
    return () => ctx.revert();
  }, [active]);
  return (
    <div ref={ref} className="flex h-7 items-center gap-[3px]" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "block w-[2.5px] origin-center rounded-full",
            active ? "bg-[var(--holo-cyan)]" : "bg-[var(--holo-cyan)]/35",
          )}
          style={{ height: "100%" }}
        />
      ))}
    </div>
  );
}

function findPart(p: Record<string, unknown>) {
  const id = String(p.id ?? "");
  if (id) {
    const byId = partById(id);
    if (byId) return byId;
  }
  const q = String(p.match ?? p.name ?? "").toLowerCase();
  return CATALOG.find((x) => x.name.toLowerCase().includes(q));
}

export function VizierTab() {
  const {
    tasks,
    blocks,
    prayers,
    addTask,
    resolveAndAddBlock,
    removeTask,
    removeBlock,
    updateBlock,
    markBlockDone,
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
    buyPart,
    equipPart,
    unequipPart,
    sellPart,
    startFocus,
    endFocus,
    awardCredits,
    bootGreetedSession,
    markBootGreeted,
  } = useApp();
  const openrouterKey = useApp((s) => s.openrouterKey);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<VizierAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
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
    return tasks.filter((t) => !t.done && t.dueDate && new Date(t.dueDate).getTime() < now);
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
    const dow = now.getDay();
    const upcoming = blocks
      .filter((b) => {
        const d = typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
        return d === dow;
      })
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
      ? ` Flagging ${overdue.length} overdue ${overdue.length === 1 ? "mission" : "missions"} — top: "${overdue[0].title}".`
      : "";
    const creditsLine = ` Credit balance: ${useApp.getState().credits} CR.`;
    const greet = `Good ${now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, ${profile.name}. ${formatTime12(now, false)} (${tzName()}). ${nextLine}${overdueLine}${creditsLine} Awaiting your directive, Sir.`;
    pushToActive({
      id: newId(),
      role: "assistant",
      content: greet,
      createdAt: new Date().toISOString(),
    });
    markBootGreeted(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [activeSessionId]);

  // GSAP message entrance — animate the newest message in.
  const msgBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!chat.length) return;
    const nodes = msgBoxRef.current?.querySelectorAll("[data-msg]");
    const el = nodes?.[nodes.length - 1];
    if (!el) return;
    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: 14, scale: 0.985, filter: "blur(4px)" },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.5,
        ease: "power3.out",
        clearProps: "filter",
      },
    );
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    return () => {
      tween.kill();
    };
  }, [chat.length]);

  // GSAP session-rail entrance stagger.
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.children,
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.35, ease: "power2.out", stagger: 0.04 },
      );
    }, el);
    return () => ctx.revert();
  }, [activeSessionId]);

  // GSAP typing indicator — orbiting dots around the reactor.
  const busyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = busyRef.current;
    if (!el || !busy) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll(".busy-dot"),
        { y: 0, opacity: 0.35 },
        {
          y: -5,
          opacity: 1,
          duration: 0.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          stagger: 0.14,
        },
      );
    }, el);
    return () => ctx.revert();
  }, [busy]);

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
            estimatedMinutes:
              typeof p.estimatedMinutes === "number" ? p.estimatedMinutes : undefined,
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
              typeof p.dayOfWeek === "number" ? (p.dayOfWeek as number) : new Date().getDay(),
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
        case "complete_block": {
          const match = String(p.match ?? "").toLowerCase();
          const b = blocks.find((x) => x.title.toLowerCase().includes(match));
          if (b) markBlockDone(b.id);
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
        case "buy_part": {
          const part = findPart(p);
          if (!part) {
            toast.error("Part not found in catalog.");
            break;
          }
          const ok = buyPart(part.id, part.price);
          if (ok) {
            addMemoryNote(`Purchased ${part.name} via Vizier`);
            toast.success(`${part.name} purchased · -${part.price} CR`);
          } else {
            toast.error("Insufficient credits", {
              description: `${part.name} costs ${part.price} CR.`,
            });
          }
          setActiveTab("workbench");
          break;
        }
        case "equip_part": {
          const part = findPart(p);
          if (part) {
            equipPart(part.id);
            toast.success(`${part.name} equipped to rig`);
          } else {
            toast.error("Part not found in armory.");
          }
          setActiveTab("workbench");
          break;
        }
        case "unequip_part": {
          const part = findPart(p);
          if (part) {
            unequipPart(part.id);
            toast(`${part.name} unequipped`);
          }
          setActiveTab("workbench");
          break;
        }
        case "sell_part": {
          const part = findPart(p);
          if (part) {
            const refund = Math.round(part.price * 0.6);
            sellPart(part.id, refund);
            toast(`${part.name} sold · +${refund} CR`);
          }
          setActiveTab("workbench");
          break;
        }
        case "start_focus": {
          const match = String(p.match ?? "").toLowerCase();
          const t = tasks.find((x) => x.title.toLowerCase().includes(match));
          if (t) {
            startFocus(t.id);
            toast.success(`Focus engaged: ${t.title}`);
          } else {
            toast.error("Task not found to focus.");
          }
          break;
        }
        case "end_focus":
          endFocus({ complete: p.complete === true });
          toast(p.complete === true ? "Focus closed — mission complete." : "Focus session ended.");
          break;
        case "award_credits": {
          const amount = Math.min(10, Math.max(1, Math.round(Number(p.amount) || 0)));
          awardCredits(amount);
          toast.success(`+${amount} CR awarded`);
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
        text +
        (attachments.length
          ? ` [+${attachments.length} image${attachments.length > 1 ? "s" : ""}]`
          : ""),
      createdAt: new Date().toISOString(),
    });
    const sentAttachments = attachments;
    setAttachments([]);
    setBusy(true);
    try {
      const now = new Date();
      // Pull LIVE state — never use stale closure data.
      const live = useApp.getState();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const dow = now.getDay();
      const todayBlocks = live.blocks
        .filter((b) => {
          const d = typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
          return d === dow;
        })
        .map((b) => {
          const [sh, sm] = b.start.split(":").map(Number);
          const [eh, em] = b.end.split(":").map(Number);
          return { b, sMins: sh * 60 + sm, eMins: eh * 60 + em };
        })
        .sort((a, z) => a.sMins - z.sMins);
      const activeNow = todayBlocks.find((x) => nowMins >= x.sMins && nowMins < x.eMins)?.b;
      const nextUp = todayBlocks.find((x) => x.sMins >= nowMins)?.b;
      const rigValue = live.ownedParts.reduce((s, id) => s + (partById(id)?.price ?? 0), 0);
      const ctx = buildContext({
        operator: profile.name,
        nowLocal: formatTime12(now),
        nowISO: now.toISOString(),
        weekday: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
          now.getDay()
        ],
        timezone: tzName(),
        today: todayStr(),
        app: "Chronos Vizier (CyberTime Machine)",
        tabs: ["dashboard", "namaz", "todo", "schedule", "analytics", "workbench", "vizier"],
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
          estMin: t.estimatedMinutes,
          tags: t.tags,
        })),
        blocksToday: live.blocks
          .filter((b) => {
            const d = typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
            return d === dow;
          })
          .map((b) => ({
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
        prayerTimesToday: resolveDayTimes(live.prayerTimes, live.customPrayerTimes, todayStr()),
        completedBlocksToday: live.completedBlocks?.[todayStr()] ?? [],
        credits: live.credits,
        creditsEarnedToday: live.creditHistory?.[todayStr()] ?? 0,
        ownedParts: live.ownedParts.map((id) => partById(id)?.name).filter(Boolean),
        equippedParts: live.equippedParts.map((id) => partById(id)?.name).filter(Boolean),
        rigValue,
        catalog: CATALOG.map((p) => `${p.id}(${p.slot},${p.price})`).join(" "),
        focusActive: live.focusTaskId
          ? (live.tasks.find((t) => t.id === live.focusTaskId)?.title ?? null)
          : null,
        memoryNotes: live.memory.notes.slice(0, 12),
      });
      const session = live.sessions.find((s) => s.id === live.activeSessionId) ?? live.sessions[0];
      const history = session?.messages ?? [];
      const reply = await callVizier(history, ctx, settings.aiModel, {
        maxTokens: settings.aiDepth === "deep" ? 1100 : 480,
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
    const summary = `QUICK CONTEXT BRIEF — Daily progress: ${pct}% (${done}/${tasks.length} missions). Namaz today: ${prayerDone}/5. Credits: ${useApp.getState().credits} CR. Give a tactical assessment and the single next move I must execute now.`;
    setInput("");
    await sendText(summary);
  };

  const quickDirectives: { label: string; run: () => void }[] = [
    { label: "Analyze System Status", run: quickContext },
    {
      label: "Best GPU I Can Afford",
      run: () =>
        sendText(
          "Scan my credit balance and the Armory catalog, then recommend the single best GPU I can afford right now. If I can buy it, tell me exactly what to say to purchase and equip it.",
        ),
    },
    { label: "Add Study Block 4–6 PM", run: () => sendText("/add Study block at 4 PM-6 PM") },
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

  const quickPrompt = async (prompt: string) => {
    await sendText(prompt);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* JARVIS header */}
      <div className="glass-panel corner-brackets relative mb-4 flex flex-wrap items-center gap-4 overflow-hidden px-5 py-3.5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.85_0.17_200/0.5)] to-transparent" />
        <ArcReactor size={48} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--holo-cyan)]">
            J.A.R.V.I.S. // Core Intelligence Online
          </div>
          <div className="truncate text-base font-bold tracking-wide text-foreground">
            {active?.title ?? "THE VIZIER"}
          </div>
        </div>
        {/* voice-wave core — always breathing, peaks while synthesizing */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex flex-col items-end gap-1">
            <VoiceWave active={busy} />
            <span
              className={cn(
                "font-mono text-[8px] uppercase tracking-[0.3em]",
                busy ? "text-[var(--holo-cyan)]" : "text-muted-foreground/60",
              )}
            >
              {busy ? "Synthesizing" : "Standby"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="led-dot"
              style={{ color: busy ? "var(--holo-cyan)" : "var(--holo-green)" }}
            />
            {busy ? "Processing" : "Tactical Advisor Online"}
          </span>
          <span>
            Missions{" "}
            <b className="text-[var(--holo-cyan)]">{tasks.filter((t) => !t.done).length}</b>
          </span>
          <span className="flex items-center gap-1">
            <Coins className="size-3 text-[var(--holo-amber)]" />
            <b className="text-[var(--holo-amber)]">{credits}</b>
          </span>
          <span suppressHydrationWarning>{mounted ? formatTime12(new Date(), false) : ""}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Session rail */}
        <aside className="glass-panel flex w-56 shrink-0 flex-col">
          <div className="flex items-center justify-between border-b border-[oklch(0.85_0.17_200/0.12)] px-3 py-2.5">
            <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              <MessageSquare className="size-3 text-[var(--holo-cyan)]" />
              Channels
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              title="New channel"
              onClick={() => newSession()}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
          <div ref={railRef} className="scroll-y-clean min-h-0 flex-1 p-2">
            {sessions.map((s) => {
              const isActive = s.id === active?.id;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "group mb-1 flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 transition",
                    isActive
                      ? "border-[var(--holo-cyan)]/40 bg-[oklch(0.85_0.2_200_/_0.1)]"
                      : "border-transparent hover:border-[oklch(0.66_0.27_295/0.4)] hover:bg-[oklch(1_1_1/0.03)]",
                  )}
                  onClick={() => selectSession(s.id)}
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      isActive ? "led-dot bg-[var(--holo-cyan)]" : "bg-muted-foreground/40",
                    )}
                    style={isActive ? { color: "var(--holo-cyan)" } : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium">{s.title}</div>
                    <div className="font-mono text-[9px] text-muted-foreground">
                      {s.messages.length} msgs
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (sessions.length === 1) {
                        toast.error("Cannot delete the last channel.");
                        return;
                      }
                      deleteSession(s.id);
                    }}
                    className="opacity-0 text-muted-foreground transition hover:text-[var(--holo-pink)] group-hover:opacity-100"
                    title="Delete channel"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Conversation */}
        <div className="holo-panel flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Telemetry strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[oklch(0.85_0.17_200/0.12)] bg-black/25 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>
              Channel <b className="text-[var(--holo-violet)]">{chat.length}</b>
            </span>
            <span>
              Credits <b className="text-[var(--holo-amber)]">{credits}</b>
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-[var(--holo-green)]">
              <span className="led-dot size-1.5" style={{ color: "var(--holo-green)" }} />
              Core ▮▮▮▮▯
            </span>
          </div>

          <div ref={msgBoxRef} className="scroll-y-clean min-h-0 flex-1 px-5 py-4">
            {!openrouterKey && !import.meta.env.VITE_OPENROUTER_API_KEY && (
              <div className="mb-3 rounded border border-[oklch(0.72_0.28_350_/_0.4)] bg-[oklch(0.72_0.28_350_/_0.1)] px-3 py-2 text-[11px] text-[var(--holo-pink)]">
                No OpenRouter key set — add one in System Core. It stays in your browser.
              </div>
            )}

            {mounted && overdue.length > 0 && (
              <div className="mb-4 rounded-md border border-[var(--holo-pink)]/40 bg-[var(--holo-pink)]/5 p-3 text-xs">
                <div className="mb-2 flex items-center gap-1.5 text-[var(--holo-pink)] font-semibold">
                  <AlertTriangle className="size-3.5" />
                  {overdue.length} overdue {overdue.length === 1 ? "mission" : "missions"} detected
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() =>
                      quickPrompt(
                        `Clear my overdue backlog. Reschedule or close these: ${overdue.map((t) => t.title).join(", ")}. Use add_block / complete_task actions.`,
                      )
                    }
                    className="rounded border border-border bg-background/60 px-2 py-1 text-[11px] transition hover:border-[var(--holo-cyan)]/50"
                  >
                    Clear Backlog
                  </button>
                  <button
                    onClick={() =>
                      quickPrompt(
                        "Optimize my schedule for the rest of today. Suggest add_block actions to recover lost time.",
                      )
                    }
                    className="rounded border border-border bg-background/60 px-2 py-1 text-[11px] transition hover:border-[var(--holo-cyan)]/50"
                  >
                    Optimize Schedule
                  </button>
                  <button
                    onClick={() =>
                      quickPrompt(
                        `Reschedule each of these overdue tasks to a sensible block today or tomorrow: ${overdue.map((t) => t.title).join(", ")}.`,
                      )
                    }
                    className="rounded border border-border bg-background/60 px-2 py-1 text-[11px] transition hover:border-[var(--holo-cyan)]/50"
                  >
                    Reschedule Overdue
                  </button>
                </div>
              </div>
            )}

            {mounted &&
              chat.map((m) => (
                <div
                  key={m.id}
                  data-msg
                  className={cn("mb-4 flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "holo-panel relative max-w-[85%] px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                      m.role === "user"
                        ? "border-[oklch(0.66_0.27_295/0.45)] bg-[oklch(0.66_0.27_295/0.08)]"
                        : "border-l-2 border-l-[var(--holo-cyan)]/50 border-[oklch(0.85_0.17_200/0.28)] bg-[oklch(0.1_0.02_270/0.5)]",
                    )}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em]">
                      {m.role === "assistant" ? (
                        <>
                          <Sparkles className="size-3 text-[var(--holo-cyan)]" />
                          <span className="text-[var(--holo-cyan)]">J.A.R.V.I.S.</span>
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
              <div
                ref={busyRef}
                className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--holo-cyan)]"
              >
                <span className="relative flex size-4 items-center justify-center">
                  <span
                    className="absolute inset-0 animate-[holo-spin_1.4s_linear_infinite] rounded-full border-2 border-transparent"
                    style={{ borderTopColor: "var(--holo-cyan)" }}
                  />
                  <span className="busy-dot size-1 rounded-full bg-[var(--holo-cyan)]" />
                </span>
                <span className="flex gap-1">
                  <span className="busy-dot size-1.5 rounded-full bg-[var(--holo-cyan)]" />
                  <span className="busy-dot size-1.5 rounded-full bg-[var(--holo-violet)]" />
                  <span className="busy-dot size-1.5 rounded-full bg-[var(--holo-pink)]" />
                </span>
                JARVIS processing
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input dock */}
          <div className="border-t border-[oklch(0.85_0.17_200/0.15)] bg-black/30 p-3">
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
                className="shrink-0 self-end border-[oklch(0.85_0.17_200/0.2)] bg-[oklch(0.85_0.17_200/0.05)]"
              >
                <Paperclip className="size-3.5 text-[var(--holo-cyan)]" />
              </Button>
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
                placeholder="Issue a directive to J.A.R.V.I.S. — add missions, schedule blocks, manage the Armory…"
                className="resize-none border-[oklch(0.85_0.17_200/0.25)] bg-black/40 focus:border-[var(--holo-cyan)]"
              />
              <Button
                onClick={send}
                disabled={busy}
                className="clip-angular shrink-0 self-end bg-[oklch(0.85_0.17_200/0.9)] font-bold tracking-wider text-black hover:bg-[var(--holo-cyan)]"
              >
                EXECUTE <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
              ⏎ send · shift+⏎ newline · full control of missions, schedule & armory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
