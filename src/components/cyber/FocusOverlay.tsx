import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { X, CheckCircle2, Zap } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");

export function FocusOverlay() {
  const focusTaskId = useApp((s) => s.focusTaskId);
  const focusStartedAt = useApp((s) => s.focusStartedAt);
  const tasks = useApp((s) => s.tasks);
  const endFocus = useApp((s) => s.endFocus);
  const [now, setNow] = useState<number>(Date.now());

  const task = useMemo(
    () => tasks.find((t) => t.id === focusTaskId),
    [tasks, focusTaskId],
  );

  useEffect(() => {
    if (!focusTaskId) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [focusTaskId]);

  if (!focusTaskId || !focusStartedAt || !task) return null;

  const elapsedMs = Math.max(0, now - new Date(focusStartedAt).getTime());
  const est = (task.estimatedMinutes ?? 0) * 60_000;
  const targetMs = est > 0 ? est : 25 * 60_000; // 25min default
  const remaining = Math.max(0, targetMs - elapsedMs);
  const overrun = elapsedMs > targetMs;
  const displayMs = overrun ? elapsedMs - targetMs : remaining;
  const totalSec = Math.floor(displayMs / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.08_0.02_270)]/95 backdrop-blur-2xl">
      <div className="glass-panel w-[min(560px,92vw)] p-8 relative">
        <button
          onClick={() => endFocus()}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          title="Abort session"
        >
          <X className="size-5" />
        </button>
        <div className="text-[10px] uppercase tracking-[0.4em] text-[var(--holo-cyan)]">
          Deep Focus // Mission Engaged
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-tight">{task.title}</h2>
        <div className="mt-1 text-xs text-muted-foreground uppercase tracking-widest">
          Priority: {task.priority}
          {task.estimatedMinutes ? ` • Target: ${task.estimatedMinutes}m` : " • No estimate (25m sprint)"}
        </div>

        <div className="my-8 text-center">
          <div
            className={`font-mono text-7xl font-black tabular-nums ${
              overrun ? "text-[var(--holo-pink)]" : "neon-text"
            }`}
          >
            {pad(hh)}:{pad(mm)}:{pad(ss)}
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
            {overrun ? "Overrun" : "Remaining"}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => endFocus()} className="flex-1">
            <X className="size-4 mr-1" /> Abort
          </Button>
          <Button
            onClick={() => endFocus({ complete: true })}
            className="flex-1 bg-[image:var(--gradient-cyber)] text-background hover:opacity-90"
          >
            <CheckCircle2 className="size-4 mr-1" /> Complete
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Zap className="size-3 text-[var(--holo-cyan)]" />
          Efficiency logs to XP on completion
        </div>
      </div>
    </div>
  );
}