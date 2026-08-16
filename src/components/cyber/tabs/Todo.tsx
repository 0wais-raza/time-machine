import { useMemo, useState } from "react";
import { useApp, type Priority } from "@/lib/store";
import { PanelHeader } from "../PanelHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search, AlertTriangle, Play, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];

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

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter !== "all" && t.priority !== filter) return false;
      if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [tasks, q, filter]);

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
        eyebrow="Tab 03 / Strategic"
        title="Strategic Todo"
        subtitle="Every task is a contract with your future self."
      />

      <div className="glass-panel mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-3"
            placeholder="Task title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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

      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
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

      <div className="glass-panel scroll-y-clean min-h-0 flex-1 divide-y divide-border">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No tasks match.</div>
        )}
        {filtered.map((t) => {
          const overdue = !t.done && t.dueDate && new Date(t.dueDate).getTime() < Date.now();
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-start gap-4 px-5 py-4 transition hover:bg-secondary/30",
                t.done && "opacity-50",
                overdue && "ring-1 ring-inset ring-[var(--neon-pink)]/40 bg-[oklch(0.72_0.28_350_/_0.04)]",
              )}
            >
              <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t.id)} className="mt-1" />
              <div className="flex-1 min-w-0">
                <input
                  value={t.title}
                  onChange={(e) => updateTask(t.id, { title: e.target.value })}
                  className={cn(
                    "w-full bg-transparent font-medium outline-none border-b border-transparent focus:border-[var(--neon-cyan)]/40",
                    t.done && "line-through",
                  )}
                />
                <input
                  value={t.description ?? ""}
                  placeholder="Add description…"
                  onChange={(e) => updateTask(t.id, { description: e.target.value })}
                  className="mt-0.5 w-full bg-transparent text-xs text-muted-foreground outline-none border-b border-transparent focus:border-[var(--neon-cyan)]/30 placeholder:text-muted-foreground/50"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select
                    value={t.priority}
                    onValueChange={(v) => updateTask(t.id, { priority: v as Priority })}
                  >
                    <SelectTrigger className="h-6 w-24 text-[10px] uppercase tracking-widest">
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
                    className="rounded border border-border bg-background/40 px-2 py-0.5 text-[10px] outline-none focus:border-[var(--neon-cyan)]/50"
                  />
                  <input
                    type="datetime-local"
                    value={t.dueDate ? t.dueDate.slice(0, 16) : ""}
                    onChange={(e) =>
                      updateTask(t.id, {
                        dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      })
                    }
                    className="rounded border border-border bg-background/40 px-2 py-0.5 text-[10px] font-mono outline-none focus:border-[var(--neon-cyan)]/50"
                  />
                  {overdue && (
                    <span className="flex items-center gap-1 rounded border border-[var(--neon-pink)]/50 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-[var(--neon-pink)]">
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
                    className="w-16 rounded border border-border bg-background/40 px-2 py-0.5 text-[10px] font-mono outline-none focus:border-[var(--neon-cyan)]/50"
                    title="Estimated minutes"
                  />
                  {typeof t.actualMinutes === "number" && t.actualMinutes > 0 && (
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      logged {t.actualMinutes}m
                    </span>
                  )}
                  {typeof t.credits === "number" && t.credits > 0 && (
                    <span className="flex items-center gap-1 rounded-md border border-primary/40 px-1.5 py-0.5 text-[10px] font-medium text-primary">
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
                  className="text-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"
                >
                  <Play className="size-3.5 mr-1" /> Initiate
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => removeTask(t.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}