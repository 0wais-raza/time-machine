import { useMemo, useState } from "react";
import { useApp, type Priority } from "@/lib/store";
import { PanelHeader } from "../PanelHeader";
import { HudLabel } from "../HudLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  Play,
  Zap,
  Timer,
  CalendarClock,
  Tag,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/clock";

const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];

const PRIORITY_STYLE: Record<Priority, { bar: string; text: string; chip: string; glow: string }> = {
  low: {
    bar: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    chip: "border-[oklch(1_1_1/0.12)] text-muted-foreground",
    glow: "border-[oklch(1_1_1/0.06)]",
  },
  medium: {
    bar: "bg-[var(--holo-cyan)]",
    text: "text-[var(--holo-cyan)]",
    chip: "border-[oklch(0.85_0.17_200/0.4)] text-[var(--holo-cyan)]",
    glow: "border-[oklch(0.85_0.17_200/0.18)]",
  },
  high: {
    bar: "bg-[var(--holo-violet)]",
    text: "text-[var(--holo-violet)]",
    chip: "border-[oklch(0.66_0.27_295/0.5)] text-[var(--holo-violet)]",
    glow: "border-[oklch(0.66_0.27_295/0.2)]",
  },
  critical: {
    bar: "bg-[var(--holo-pink)]",
    text: "text-[var(--holo-pink)]",
    chip: "border-[oklch(0.72_0.24_350/0.5)] text-[var(--holo-pink)]",
    glow: "border-[oklch(0.72_0.24_350/0.25)]",
  },
};

function dueLabel(dueDate: string | undefined, now: Date): { text: string; danger: boolean } | null {
  if (!dueDate) return null;
  const diffMs = new Date(dueDate).getTime() - now.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 0) return { text: "OVERDUE", danger: true };
  if (mins < 60) return { text: `in ${mins}m`, danger: false };
  const h = Math.floor(mins / 60);
  if (h < 24) return { text: `in ${h}h ${mins % 60}m`, danger: false };
  return {
    text: new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    danger: false,
  };
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="glass-panel px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={cn("font-mono-tech text-[22px] font-bold tabular-nums leading-none", accent)}>{value}</span>
        {sub && <span className="truncate text-[11px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

export function TodoTab() {
  const { tasks, addTask, toggleTask, removeTask, updateTask, startFocus, focusTaskId } = useApp();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [tags, setTags] = useState("");
  const [due, setDue] = useState("");
  const [duration, setDuration] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Priority>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const now = useNow(30000);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter !== "all" && t.priority !== filter) return false;
      if (q && !`${t.title} ${t.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [tasks, q, filter]);

  const doneToday = tasks.filter(
    (t) => t.done && t.completedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10),
  ).length;
  const open = tasks.filter((t) => !t.done).length;
  const critical = tasks.filter((t) => !t.done && t.priority === "critical").length;
  const done = tasks.filter((t) => t.done).length;
  const pct = Math.round((done / Math.max(1, tasks.length)) * 100);

  const overdue = useMemo(
    () => filtered.filter((t) => !t.done && t.dueDate && new Date(t.dueDate).getTime() < Date.now()),
    [filtered],
  );
  const openGrouped = useMemo(() => {
    const rest = filtered.filter(
      (t) => !t.done && !(t.dueDate && new Date(t.dueDate).getTime() < Date.now()),
    );
    return (["critical", "high", "medium", "low"] as Priority[])
      .map((p) => ({ p, items: rest.filter((t) => t.priority === p) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);
  const completed = useMemo(() => filtered.filter((t) => t.done), [filtered]);

  const submit = () => {
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      description: desc.trim() || undefined,
      priority,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      dueDate: due ? new Date(due).toISOString() : undefined,
      estimatedMinutes: duration ? Math.max(1, parseInt(duration, 10)) : undefined,
    });
    setTitle("");
    setDesc("");
    setTags("");
    setDue("");
    setDuration("");
  };

  const renderRow = (t: (typeof tasks)[number]) => {
    const isOverdue = !t.done && t.dueDate && new Date(t.dueDate).getTime() < Date.now();
    const dl = now ? dueLabel(t.dueDate, now) : null;
    const st = PRIORITY_STYLE[t.priority];
    return (
      <div
        key={t.id}
        className={cn(
          "group relative flex items-start gap-3 rounded-lg border bg-[oklch(1_1_1/0.015)] py-3 pl-4 pr-3 transition hover:border-[oklch(0.85_0.17_200/0.3)]",
          st.glow,
          t.done && "opacity-45",
          isOverdue && "border-[oklch(0.72_0.24_350/0.35)]",
        )}
      >
        {/* priority glow bar */}
        <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-full", st.bar)} />
        <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t.id)} className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              value={t.title}
              onChange={(e) => updateTask(t.id, { title: e.target.value })}
              className={cn(
                "w-full min-w-0 bg-transparent text-sm font-medium outline-none border-b border-transparent focus:border-[var(--holo-cyan)]/40",
                t.done && "line-through",
              )}
            />
          </div>
          {t.description && (
            <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>
          )}

          {/* meta chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Select
              value={t.priority}
              onValueChange={(v) => updateTask(t.id, { priority: v as Priority })}
            >
              <SelectTrigger className={cn("h-6 w-[92px] border text-[10px] uppercase tracking-widest", st.chip)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {t.dueDate && (
              <span
                className={cn(
                  "flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px]",
                  isOverdue
                    ? "border-[oklch(0.72_0.24_350/0.5)] bg-[oklch(0.72_0.24_350/0.08)] text-[var(--holo-pink)]"
                    : "border-[oklch(0.85_0.17_200/0.3)] text-[var(--holo-cyan)]",
                )}
                title="Due"
                suppressHydrationWarning
              >
                <CalendarClock className="size-3" />
                {dl?.text ?? "—"}
              </span>
            )}

            {t.tags.length > 0 && (
              <span className="flex items-center gap-1 rounded-md border border-border bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" title="Tags">
                <Tag className="size-3" />
                {t.tags.join(", ")}
              </span>
            )}

            {typeof t.estimatedMinutes === "number" && (
              <span className="flex items-center gap-1 rounded-md border border-border bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" title="Estimated duration">
                <Timer className="size-3" />
                {t.estimatedMinutes}m
              </span>
            )}

            {typeof t.actualMinutes === "number" && t.actualMinutes > 0 && (
              <span className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" title="Logged focus time">
                <CheckCircle2 className="size-3" />
                {t.actualMinutes}m logged
              </span>
            )}

            {!t.done && (
              <span
                className="flex items-center gap-1 rounded-md border border-[oklch(0.82_0.16_80/0.35)] bg-[oklch(0.82_0.16_80/0.07)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--holo-amber)]"
                title="Credits on completion"
              >
                <Zap className="size-3" />
                +{t.priority === "critical" ? 8 : t.priority === "high" ? 5 : t.priority === "medium" ? 3 : 1} CR
              </span>
            )}
            {t.done && typeof t.credits === "number" && (
              <span className="flex items-center gap-1 rounded-md border border-[oklch(0.82_0.16_80/0.35)] bg-[oklch(0.82_0.16_80/0.07)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--holo-amber)]">
                <Zap className="size-3" /> +{t.credits} CR banked
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!t.done && (
            <Button
              variant="ghost"
              size="sm"
              disabled={!!focusTaskId}
              onClick={() => startFocus(t.id)}
              title={focusTaskId ? "A focus session is already active" : "Initiate deep focus"}
              className="shrink-0 text-[var(--holo-cyan)] hover:text-[var(--holo-cyan)]"
            >
              <Play className="mr-1 size-3.5" /> Focus
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => removeTask(t.id)} className="shrink-0">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        eyebrow="Task Matrix"
        title="Mission Control"
        subtitle="Every mission is a contract with your future self. Clear them in priority order."
      />

      {/* Telemetry */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open Missions" value={String(open)} accent="text-[var(--holo-cyan)]" />
        <Stat label="Critical" value={String(critical)} accent="text-[var(--holo-pink)]" sub={critical ? "execute now" : undefined} />
        <Stat label="Done Today" value={String(doneToday)} accent="text-[var(--holo-green)]" />
        <Stat label="Completion" value={`${pct}%`} sub={`${done}/${tasks.length}`} accent="text-[var(--holo-violet)]" />
      </div>

      {/* Progress rail */}
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-[oklch(1_1_1/0.06)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--holo-cyan)] to-[var(--holo-violet)] shadow-[0_0_8px_oklch(0.85_0.17_200/0.5)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Directive intake */}
      <div className="glass-panel mb-4 p-4">
        <HudLabel accent="cyan" className="mb-3">Directive Intake</HudLabel>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-3"
            placeholder="Mission title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Input
            className="md:col-span-2"
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger className="md:col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="md:col-span-1"
            type="number"
            min={1}
            placeholder="min"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            title="Estimated duration (minutes)"
          />
          <Input
            className="md:col-span-2"
            placeholder="tags, comma"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <Input
            className="md:col-span-1"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            title="Due date"
          />
          <Button onClick={submit} className="md:col-span-1">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search missions or tags…"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as "all" | Priority)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mission list */}
      <div className="scroll-y-clean min-h-0 flex-1 space-y-4 pb-2">
        {tasks.length === 0 && (
          <div className="glass-panel p-8 text-center text-sm text-muted-foreground">
            No missions logged. Issue your first directive above — or tell J.A.R.V.I.S. to add one.
          </div>
        )}

        {overdue.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--holo-pink)]">
              <AlertTriangle className="size-3.5" />
              Overdue ({overdue.length})
              <span className="h-px flex-1 bg-gradient-to-r from-[oklch(0.72_0.24_350/0.4)] to-transparent" />
            </div>
            <div className="space-y-2">{overdue.map(renderRow)}</div>
          </section>
        )}

        {openGrouped.map(({ p, items }) => (
          <section key={p}>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--holo-cyan)]">
              <span className={cn("size-1.5 rounded-full", p === "critical" ? "bg-[var(--holo-pink)]" : "bg-[var(--holo-cyan)]")} />
              {p} priority ({items.length})
              <span className="h-px flex-1 bg-gradient-to-r from-[oklch(0.85_0.17_200/0.25)] to-transparent" />
            </div>
            <div className="space-y-2">{items.map(renderRow)}</div>
          </section>
        ))}

        {openGrouped.length === 0 && overdue.length === 0 && tasks.length > 0 && (
          <div className="glass-panel flex items-center gap-2 p-6 text-sm italic text-muted-foreground">
            <CheckCircle2 className="size-4 text-[var(--holo-green)]" />
            No open missions match — all directives executed. Well done, Sir.
          </div>
        )}

        {completed.length > 0 && (
          <section>
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="mb-2 flex w-full items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground transition hover:text-foreground"
            >
              {showCompleted ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              Completed ({completed.length})
              <span className="h-px flex-1 bg-gradient-to-r from-muted-foreground/25 to-transparent" />
            </button>
            {showCompleted && <div className="space-y-2">{completed.map(renderRow)}</div>}
          </section>
        )}
      </div>
    </div>
  );
}
