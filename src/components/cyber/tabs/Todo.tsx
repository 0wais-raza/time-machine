import { useMemo, useState } from "react";
import { useApp, type Priority } from "@/lib/store";
import { PanelHeader } from "../PanelHeader";
import { HudLabel } from "../HudLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search, AlertTriangle, Play, Zap, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/clock";

const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];

const PRIORITY_STYLE: Record<Priority, { bar: string; text: string; chip: string }> = {
  low: {
    bar: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    chip: "border-[oklch(1_1_1/0.1)] text-muted-foreground",
  },
  medium: {
    bar: "bg-[var(--holo-cyan)]",
    text: "text-[var(--holo-cyan)]",
    chip: "border-[oklch(0.85_0.17_200/0.4)] text-[var(--holo-cyan)]",
  },
  high: {
    bar: "bg-[var(--holo-violet)]",
    text: "text-[var(--holo-violet)]",
    chip: "border-[oklch(0.66_0.27_295/0.5)] text-[var(--holo-violet)]",
  },
  critical: {
    bar: "bg-[var(--holo-pink)]",
    text: "text-[var(--holo-pink)]",
    chip: "border-[oklch(0.72_0.24_350/0.5)] text-[var(--holo-pink)]",
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
  const now = useNow(30000);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter !== "all" && t.priority !== filter) return false;
      if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [tasks, q, filter]);

  const doneToday = tasks.filter((t) => t.done && t.completedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
  const open = tasks.filter((t) => !t.done).length;
  const critical = tasks.filter((t) => !t.done && t.priority === "critical").length;
  const pct = Math.round((tasks.filter((t) => t.done).length / Math.max(1, tasks.length)) * 100);

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        eyebrow="Task Matrix"
        title="Mission Control"
        subtitle="Every task is a contract with your future self."
      />

      {/* Telemetry */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open Missions" value={String(open)} accent="text-[var(--holo-cyan)]" />
        <Stat label="Critical" value={String(critical)} accent="text-[var(--holo-pink)]" sub={critical ? "execute now" : undefined} />
        <Stat label="Done Today" value={String(doneToday)} accent="text-[var(--holo-green)]" />
        <Stat label="Completion" value={`${pct}%`} sub={`${tasks.filter((t) => t.done).length}/${tasks.length}`} accent="text-[var(--holo-violet)]" />
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
            placeholder="Task title…"
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
            <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
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
            placeholder="Search missions…"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as "all" | Priority)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mission list */}
      <div className="glass-panel scroll-y-clean min-h-0 flex-1 overflow-hidden">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {tasks.length === 0 ? "No missions logged. Issue your first directive above." : "No tasks match."}
          </div>
        )}
        <div className="divide-y divide-[oklch(1_1_1/0.05)]">
          {filtered.map((t) => {
            const overdue = !t.done && t.dueDate && new Date(t.dueDate).getTime() < Date.now();
            const dl = now ? dueLabel(t.dueDate, now) : null;
            const st = PRIORITY_STYLE[t.priority];
            return (
              <div
                key={t.id}
                className={cn(
                  "group relative flex items-start gap-4 py-4 pl-4 pr-5 transition hover:bg-[oklch(1_1_1/0.02)]",
                  t.done && "opacity-45",
                )}
              >
                {/* priority glow bar */}
                <span className={cn("absolute inset-y-0 left-0 w-[3px]", st.bar, overdue && "bg-[var(--holo-pink)]")} />
                {overdue && (
                  <span className="absolute inset-0 pointer-events-none shadow-[inset_0_0_24px_oklch(0.72_0.24_350/0.06)]" />
                )}
                <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t.id)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <input
                    value={t.title}
                    onChange={(e) => updateTask(t.id, { title: e.target.value })}
                    className={cn(
                      "w-full bg-transparent font-medium outline-none border-b border-transparent focus:border-[var(--holo-cyan)]/40",
                      t.done && "line-through",
                    )}
                  />
                  <input
                    value={t.description ?? ""}
                    placeholder="Add description…"
                    onChange={(e) => updateTask(t.id, { description: e.target.value })}
                    className="mt-0.5 w-full bg-transparent text-xs text-muted-foreground outline-none border-b border-transparent focus:border-[var(--holo-cyan)]/30 placeholder:text-muted-foreground/50"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Select
                      value={t.priority}
                      onValueChange={(v) => updateTask(t.id, { priority: v as Priority })}
                    >
                      <SelectTrigger className={cn("h-6 w-24 border text-[10px] uppercase tracking-widest", st.chip)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      value={t.tags.join(", ")}
                      onChange={(e) =>
                        updateTask(t.id, {
                          tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      placeholder="tags…"
                      className="rounded border border-border bg-background/40 px-2 py-0.5 text-[10px] outline-none focus:border-[var(--holo-cyan)]/50"
                    />
                    <input
                      type="datetime-local"
                      value={t.dueDate ? t.dueDate.slice(0, 16) : ""}
                      onChange={(e) =>
                        updateTask(t.id, {
                          dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                        })
                      }
                      className="rounded border border-border bg-background/40 px-2 py-0.5 text-[10px] font-mono outline-none focus:border-[var(--holo-cyan)]/50"
                    />
                    {dl && (
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px]",
                          dl.danger
                            ? "border-[oklch(0.72_0.24_350/0.5)] text-[var(--holo-pink)]"
                            : "border-[oklch(0.85_0.17_200/0.3)] text-[var(--holo-cyan)]",
                        )}
                        suppressHydrationWarning
                      >
                        <Timer className="size-3" /> {dl.text}
                      </span>
                    )}
                    {overdue && (
                      <span className="flex items-center gap-1 rounded border border-[var(--holo-pink)]/50 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-[var(--holo-pink)]">
                        <AlertTriangle className="size-3" /> overdue
                      </span>
                    )}
                    <input
                      type="number"
                      min={1}
                      value={t.estimatedMinutes ?? ""}
                      placeholder="est min"
                      onChange={(e) =>
                        updateTask(t.id, {
                          estimatedMinutes: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined,
                        })
                      }
                      className="w-16 rounded border border-border bg-background/40 px-2 py-0.5 text-[10px] font-mono outline-none focus:border-[var(--holo-cyan)]/50"
                      title="Estimated minutes"
                    />
                    {typeof t.actualMinutes === "number" && t.actualMinutes > 0 && (
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        logged {t.actualMinutes}m
                      </span>
                    )}
                    {typeof t.credits === "number" && t.credits > 0 && (
                      <span className="flex items-center gap-1 rounded-md border border-[oklch(0.82_0.16_80/0.35)] bg-[oklch(0.82_0.16_80/0.07)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--holo-amber)]">
                        <Zap className="size-3" /> +{t.credits} CR
                      </span>
                    )}
                  </div>
                </div>
                {!t.done && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!focusTaskId}
                    onClick={() => startFocus(t.id)}
                    title={focusTaskId ? "A focus session is already active" : "Initiate deep focus"}
                    className="shrink-0 text-[var(--holo-cyan)] hover:text-[var(--holo-cyan)]"
                  >
                    <Play className="size-3.5 mr-1" /> Initiate
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => removeTask(t.id)} className="shrink-0">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
