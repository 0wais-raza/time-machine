import { useMemo, useState } from "react";
import { useApp, PRAYERS } from "@/lib/store";
import { PanelHeader } from "../PanelHeader";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildContext, callGemini } from "@/lib/gemini";
import { toast } from "sonner";
import { Gauge, Coins } from "lucide-react";
import { todayStr } from "@/lib/store";
import { useGsapReveal } from "@/hooks/useGsapReveal";

function lastNDays(n: number): string[] {
  const arr: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
}

export function AnalyticsTab() {
  const app = useApp();
  const tasks = Array.isArray(app.tasks) ? app.tasks : [];
  const prayers = app.prayers ?? {};
  const blocks = Array.isArray(app.blocks) ? app.blocks : [];
  const completedBlocks = app.completedBlocks ?? {};
  const creditHistory = app.creditHistory ?? {};
  const credits = app.credits ?? 0;
  const { geminiKey, sessions, activeSessionId, settings } = app;
  const [summary, setSummary] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const gridRef = useGsapReveal<HTMLDivElement>("analytics");

  const creditDaily = useMemo(
    () =>
      lastNDays(14).map((d) => ({
        day: new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        credits: creditHistory[d] ?? 0,
      })),
    [creditHistory],
  );

  const creditWeekly = useMemo(() => {
    const days = lastNDays(28);
    const weeks: { week: string; credits: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const slice = days.slice(i * 7, i * 7 + 7);
      weeks.push({
        week: i === 3 ? "This week" : `${4 - i - 1}w ago`,
        credits: slice.reduce((s, d) => s + (creditHistory[d] ?? 0), 0),
      });
    }
    return weeks;
  }, [creditHistory]);

  const earnedToday = creditHistory[todayStr()] ?? 0;

  const weekly = useMemo(() => {
    return lastNDays(7).map((d) => {
      const prayerCount = PRAYERS.filter((p) => prayers[d]?.[p.name]).length;
      const dayTasks = tasks.filter((t) => t.createdAt.slice(0, 10) === d);
      const dayDone = dayTasks.filter((t) => t.done).length;
      const taskScore = dayTasks.length ? (dayDone / dayTasks.length) * 60 : 0;
      const prayerScore = (prayerCount / 5) * 40;
      return {
        day: new Date(d).toLocaleDateString("en-US", { weekday: "short" }),
        productivity: Math.round(taskScore + prayerScore),
        prayers: prayerCount,
        tasks: dayDone,
      };
    });
  }, [prayers, tasks]);

  const score = useMemo(() => {
    const totalTasks = tasks.length || 1;
    const taskPct = tasks.filter((t) => t.done).length / totalTasks;
    const today = new Date().toISOString().slice(0, 10);
    const todayP = prayers[today] ?? {};
    const prayerPct = Object.values(todayP).filter(Boolean).length / 5;
    const totalBlocks = blocks.length || 1;
    const adherence = Math.min(1, blocks.filter((b) => b.date === today).length / Math.max(1, blocks.filter((b) => b.date === today).length));
    return Math.round((taskPct * 0.5 + adherence * 0.3 + prayerPct * 0.2) * 100);
  }, [tasks, prayers, blocks]);

  const velocity = useMemo(() => {
    const today = todayStr();
    const dow = new Date().getDay();
    const todayBlocks = blocks.filter((b) => {
      const d = typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
      return d === dow;
    });
    const doneIds = completedBlocks[today] ?? [];
    const done = doneIds.length;
    if (!todayBlocks.length) return { pct: 0, done, planned: 0 };
    const pct = Math.min(100, Math.round((done / todayBlocks.length) * 100));
    return { pct, done, planned: todayBlocks.length };
  }, [blocks, completedBlocks]);

  const completion = useMemo(() => {
    const done = tasks.filter((t) => t.done).length;
    return [
      { name: "Done", value: done },
      { name: "Open", value: Math.max(0, tasks.length - done) },
    ];
  }, [tasks]);

  const ask = async () => {
    setBusy(true);
    setSummary("");
    try {
      const ctx = buildContext({ tasks, blocks, prayers, mode: "analytics-summary" });
      const session = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
      const recent = session?.messages.slice(-3) ?? [];
      const reply = await callGemini(
        geminiKey,
        [
          ...recent,
          {
            id: "ana",
            role: "user",
            content:
              "Analyze my performance bottlenecks across tasks, schedule, and namaz consistency. Give a sharp 4-sentence executive brief. No actions.",
            createdAt: new Date().toISOString(),
          },
        ],
        ctx,
        undefined,
        { maxTokens: settings.aiDepth === "deep" ? 1400 : 600 },
      );
      setSummary(reply.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(msg);
      setSummary(`System fault: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PanelHeader
        eyebrow="Signals"
        title="Analytics"
        subtitle="Performance, consistency, and credit flow."
      />

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="glass-panel flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-xs text-muted-foreground">Productivity score</div>
            <div className="font-mono-tech text-3xl font-bold tabular-nums">
              {score}<span className="text-base text-muted-foreground">/100</span>
            </div>
          </div>
        </div>
        <div className="glass-panel flex items-center justify-between px-5 py-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gauge className="size-3" /> Execution velocity
            </div>
            <div className="font-mono-tech text-3xl font-bold tabular-nums text-primary">
              {velocity.pct}<span className="text-base text-muted-foreground">%</span>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {velocity.done} done / {velocity.planned} blocks today
          </div>
        </div>
        <div className="glass-panel flex items-center justify-between px-5 py-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="size-3" /> Cyber Credits
            </div>
            <div className="font-mono-tech text-3xl font-bold tabular-nums">{credits}</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">+{earnedToday} today</div>
        </div>
      </div>

      <div ref={gridRef} className="grid gap-4 md:grid-cols-2">
        <div className="glass-panel p-5">
          <h3 className="mb-4 text-sm font-semibold">Daily credit earnings (14d)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={creditDaily}>
              <defs>
                <linearGradient id="cr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={10} interval={1} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10 }} />
              <Area type="monotone" dataKey="credits" stroke="var(--color-primary)" fill="url(#cr)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel p-5">
          <h3 className="mb-4 text-sm font-semibold">Weekly credit earnings</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={creditWeekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="week" stroke="var(--color-muted-foreground)" fontSize={10} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10 }} />
              <Bar dataKey="credits" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel p-5">
          <h3 className="mb-4 text-sm font-semibold">Weekly productivity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weekly}>
              <defs>
                <linearGradient id="p1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={10} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={10} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10 }} />
              <Area type="monotone" dataKey="productivity" stroke="var(--color-primary)" fill="url(#p1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel p-5">
          <h3 className="mb-4 text-sm font-semibold">Namaz consistency</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={10} />
              <YAxis domain={[0, 5]} stroke="var(--color-muted-foreground)" fontSize={10} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10 }} />
              <Bar dataKey="prayers" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel p-5">
          <h3 className="mb-4 text-sm font-semibold">Task completion</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={completion} dataKey="value" innerRadius={50} outerRadius={80}>
                <Cell fill="var(--color-primary)" />
                <Cell fill="var(--color-secondary)" />
              </Pie>
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> Done</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-secondary" /> Open</span>
          </div>
        </div>

        <div className="glass-panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Vizier's executive brief</h3>
            <Button size="sm" onClick={ask} disabled={busy}>
              <Sparkles className="size-3.5 mr-1" /> {busy ? "Analyzing…" : "Generate"}
            </Button>
          </div>
          <div className="min-h-[180px] rounded-lg border border-border bg-background/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
            {summary || (
              <span className="text-muted-foreground italic">
                Press Generate to receive a performance brief. Requires an OpenRouter API key in System Core.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}