import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, todayStr, GOAL_BONUS_CREDITS } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HudLabel } from "./HudLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, Trash2, Target, Check } from "lucide-react";

/** Animated SVG progress ring for a single goal. */
function GoalRing({
  pct,
  size = 54,
  accent,
}: {
  pct: number;
  size?: number;
  accent: string;
}) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnim(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const id = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="oklch(1 1 1 / 0.07)"
        strokeWidth="5"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (Math.min(100, anim) / 100) * c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .6s cubic-bezier(0.2,0,0,1)" }}
      />
    </svg>
  );
}

const ACCENTS = [
  { key: "cyan", color: "var(--holo-cyan)" },
  { key: "violet", color: "var(--holo-violet)" },
  { key: "amber", color: "var(--holo-amber)" },
  { key: "green", color: "var(--holo-green)" },
  { key: "pink", color: "var(--holo-pink)" },
] as const;

export function DailyGoals({ compact = false }: { compact?: boolean }) {
  const { goals, bumpGoal, addGoal, removeGoal, updateGoal, pushNotification } = useApp();
  const today = todayStr();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("1");
  const [unit, setUnit] = useState("x");

  const lastCompletedRef = useRef<Record<string, boolean>>({});

  // Celebrate crossing a goal target with a toast (fires once per crossing).
  useEffect(() => {
    for (const g of goals) {
      const cur = g.history[today] ?? 0;
      const was = lastCompletedRef.current[g.id];
      const now = cur >= g.target;
      if (was === false && now) {
        import("sonner").then(({ toast }) => {
          toast.success(`Goal complete // ${g.title}`, {
            description: `+${GOAL_BONUS_CREDITS} CR banked. Discipline compounding, Sir.`,
          });
        });
        pushNotification({
          kind: "milestone",
          title: `Goal // ${g.title}`,
          body: "Daily target reached — bonus banked.",
        });
      }
      lastCompletedRef.current[g.id] = now;
    }
  }, [goals, today, pushNotification]);

  const totals = useMemo(() => {
    const done = goals.filter((g) => (g.history[today] ?? 0) >= g.target).length;
    return { done, total: goals.length };
  }, [goals, today]);

  if (compact) {
    return (
      <div className="glass-panel p-4">
        <HudLabel accent="cyan" className="mb-3">
          Daily Goals · {totals.done}/{totals.total}
        </HudLabel>
        <div className="space-y-2.5">
          {goals.slice(0, 3).map((g, i) => {
            const cur = g.history[today] ?? 0;
            const pct = Math.min(100, Math.round((cur / g.target) * 100));
            const complete = cur >= g.target;
            const accent = ACCENTS[i % ACCENTS.length].color;
            return (
              <div key={g.id} className="flex items-center gap-3">
                <div className="relative">
                  <GoalRing pct={pct} size={44} accent={accent} />
                  <span className="absolute inset-0 flex items-center justify-center">
                    {complete ? (
                      <Check className="size-3.5 text-[var(--holo-green)]" />
                    ) : (
                      <span className="font-mono text-[9px] font-bold tabular-nums text-foreground/80">
                        {pct}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{g.title}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {cur}/{g.target} {g.unit}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => bumpGoal(g.id, -1)}
                    className="flex size-6 items-center justify-center rounded border border-border text-muted-foreground transition hover:border-[var(--holo-pink)]/40 hover:text-[var(--holo-pink)]"
                    title="Decrement"
                  >
                    <Minus className="size-3" />
                  </button>
                  <button
                    onClick={() => bumpGoal(g.id, 1)}
                    className="flex size-6 items-center justify-center rounded border border-[oklch(0.85_0.17_200/0.35)] bg-[oklch(0.85_0.17_200/0.08)] text-[var(--holo-cyan)] transition hover:bg-[oklch(0.85_0.17_200/0.16)]"
                    title="Increment"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {goals.length === 0 && (
            <div className="py-2 text-center text-xs italic text-muted-foreground">
              No goals set. Define today's wins.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <HudLabel accent="cyan">Today's Directives · {totals.done}/{totals.total} complete</HudLabel>
        <Button size="sm" variant={adding ? "secondary" : "ghost"} onClick={() => setAdding((v) => !v)}>
          <Plus className="size-3.5 mr-1" /> Goal
        </Button>
      </div>

      {adding && (
        <div className="glass-panel grid gap-2 p-3 md:grid-cols-12">
          <Input
            className="md:col-span-6"
            placeholder="Goal — e.g. Revise calculus ch. 4…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) {
                addGoal({ title: title.trim(), target: parseInt(target, 10) || 1, unit: unit.trim() || "x" });
                setTitle("");
                setAdding(false);
              }
            }}
          />
          <Input
            className="md:col-span-2"
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target"
          />
          <Input
            className="md:col-span-2"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="unit"
          />
          <Button
            className="md:col-span-2"
            onClick={() => {
              if (!title.trim()) return;
              addGoal({ title: title.trim(), target: parseInt(target, 10) || 1, unit: unit.trim() || "x" });
              setTitle("");
              setAdding(false);
            }}
          >
            <Target className="size-4 mr-1" /> Add
          </Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((g, i) => {
          const cur = g.history[today] ?? 0;
          const pct = Math.min(100, Math.round((cur / g.target) * 100));
          const complete = cur >= g.target;
          const accent = ACCENTS[i % ACCENTS.length].color;
          // 7-day mini history.
          const hist: number[] = [];
          for (let d = 6; d >= 0; d--) {
            const day = new Date();
            day.setDate(day.getDate() - d);
            const key = day.toISOString().slice(0, 10);
            const v = g.history[key] ?? 0;
            hist.push(Math.min(1, v / g.target));
          }
          return (
            <div
              key={g.id}
              className={cn(
                "glass-panel tilt-card group relative overflow-hidden p-4",
                complete && "border-[oklch(0.8_0.16_155/0.4)] shadow-[0_0_24px_oklch(0.8_0.16_155/0.12)]",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <GoalRing pct={pct} size={56} accent={accent} />
                  <span className="absolute inset-0 flex items-center justify-center">
                    {complete ? (
                      <Check className="size-4 text-[var(--holo-green)]" />
                    ) : (
                      <span className="font-mono text-[10px] font-bold tabular-nums">{pct}%</span>
                    )}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    value={g.title}
                    onChange={(e) => updateGoal(g.id, { title: e.target.value })}
                    className="w-full bg-transparent text-sm font-semibold outline-none focus:underline"
                  />
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {cur} / {g.target} {g.unit}
                    {complete && <span className="ml-1.5 text-[var(--holo-green)]">· +{GOAL_BONUS_CREDITS} CR</span>}
                  </div>
                </div>
                <button
                  onClick={() => removeGoal(g.id)}
                  className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-[var(--holo-pink)]"
                  title="Delete goal"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              {/* 7-day history bars */}
              <div className="mt-3 flex items-end gap-1" aria-hidden>
                {hist.map((v, j) => (
                  <span
                    key={j}
                    className="flex-1 rounded-t-[2px] transition-all"
                    style={{
                      height: `${6 + v * 18}px`,
                      background:
                        v >= 1 ? accent : `color-mix(in oklch, ${accent} ${Math.round(v * 55)}%, transparent)`,
                      opacity: v === 0 ? 0.15 : 1,
                    }}
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                <button
                  onClick={() => bumpGoal(g.id, -1)}
                  className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition hover:border-[var(--holo-pink)]/40 hover:text-[var(--holo-pink)]"
                >
                  <Minus className="size-3" /> 1
                </button>
                <button
                  onClick={() => bumpGoal(g.id, 1)}
                  className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-[oklch(0.85_0.17_200/0.35)] bg-[oklch(0.85_0.17_200/0.07)] font-mono text-[10px] uppercase tracking-widest text-[var(--holo-cyan)] transition hover:bg-[oklch(0.85_0.17_200/0.15)]"
                >
                  <Plus className="size-3" /> Log progress
                </button>
                <button
                  onClick={() => bumpGoal(g.id, g.target)}
                  disabled={complete}
                  className="flex h-7 items-center gap-1 rounded-md border border-[oklch(0.8_0.16_155/0.35)] bg-[oklch(0.8_0.16_155/0.07)] px-2 font-mono text-[10px] uppercase tracking-widest text-[var(--holo-green)] transition hover:bg-[oklch(0.8_0.16_155/0.15)] disabled:opacity-30"
                  title="Complete now"
                >
                  <Check className="size-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {goals.length === 0 && (
        <div className="glass-panel p-6 text-center text-sm italic text-muted-foreground">
          No daily goals yet — set 1–3 concrete wins for today above.
        </div>
      )}
    </div>
  );
}
