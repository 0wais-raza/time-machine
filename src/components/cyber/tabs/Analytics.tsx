import { useMemo, useState } from "react";
import { useApp, PRAYERS } from "@/lib/store";
import { PanelHeader } from "../PanelHeader";
import { HudLabel } from "../HudLabel";
import { Button } from "@/components/ui/button";
import { Sparkles, Coins } from "lucide-react";
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
import { buildContext, callVizier } from "@/lib/ai-core";
import { toast } from "sonner";
import { Gauge } from "lucide-react";
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

const CHART_TOOLTIP = {
  contentStyle: {
    background: "oklch(0.16 0.03 260 / 0.95)",
    border: "1px solid oklch(0.85 0.17 200 / 0.25)",
    borderRadius: 10,
    fontSize: 12,
    backdropFilter: "blur(8px)",
  },
  labelStyle: { color: "oklch(0.9 0.02 260)" },
  itemStyle: { color: "var(--color-foreground)" },
} as const;

const AXIS = { stroke: "oklch(0.85 0.17 200 / 0.35)", fontSize: 10 } as const;

function Stat({
  label,
  value,
  sub,
  accent = "text-foreground",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass-panel relative px-4 py-3.5">
      <span className="pointer-events-none absolute left-0 top-0 size-2 border-l-2 border-t-2 border-[var(--holo-cyan)/50]" />
      <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={cn("font-mono-tech text-[22px] font-bold tabular-nums leading-none", accent)}>
          {value}
        </span>
        {sub && <span className="truncate text-[11px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

function ChartPanel({
  label,
  accent = "cyan",
  children,
  right,
}: {
  label: string;
  accent?: "cyan" | "violet" | "amber" | "green";
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="glass-panel relative p-5">
      <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--holo-cyan)/60]" />
      <span className="pointer-events-none absolute right-0 top-0 size-2.5 border-r-2 border-t-2 border-[var(--holo-cyan)/60]" />
      <span className="pointer-events-none absolute bottom-0 left-0 size-2.5 border-b-2 border-l-2 border-[var(--holo-cyan)/60]" />
      <span className="pointer-events-none absolute bottom-0 right-0 size-2.5 border-b-2 border-r-2 border-[var(--holo-cyan)/60]" />
      <div className="mb-4 flex items-center justify-between gap-3">
        <HudLabel accent={accent}>{label}</HudLabel>
        {right}
      </div>
      {children}
    </div>
  );
}

function cn(...parts: (string | undefined | false)[]) {
  return parts.filter(Boolean).join(" ");
}

export function AnalyticsTab() {
  const app = useApp();
  const tasks = Array.isArray(app.tasks) ? app.tasks : [];
  const prayers = app.prayers ?? {};
  const blocks = Array.isArray(app.blocks) ? app.blocks : [];
  const completedBlocks = app.completedBlocks ?? {};
  const creditHistory = app.creditHistory ?? {};
  const credits = app.credits ?? 0;
  const { sessions, activeSessionId, settings } = app;
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
    const adherence = Math.min(
      1,
      blocks.filter((b) => b.date === today).length /
        Math.max(1, blocks.filter((b) => b.date === today).length),
    );
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
      const ctx = buildContext({
        tasks,
        blocks,
        prayers,
        credits,
        creditHistory,
        completedBlocks,
        mode: "analytics-summary",
      });
      const session = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
      const recent = session?.messages.slice(-3) ?? [];
      const reply = await callVizier(
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
        eyebrow="J.A.R.V.I.S. // Telemetry"
        title="Analytics Arcade"
        subtitle="Performance, consistency and credit flow — decoded."
      />

      {/* Telemetry strip */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Productivity Score"
          value={`${score}/100`}
          sub={score >= 70 ? "NOMINAL" : score >= 40 ? "STABLE" : "CRITICAL"}
          accent={score >= 70 ? "text-[var(--holo-green)]" : score >= 40 ? "text-[var(--holo-cyan)]" : "text-[var(--holo-pink)]"}
        />
        <Stat
          label="Execution Velocity"
          value={`${velocity.pct}%`}
          sub={`${velocity.done} done / ${velocity.planned} blocks`}
          accent="text-[var(--holo-violet)]"
          icon={<Gauge className="size-3" />}
        />
        <Stat
          label="Cyber Credits"
          value={String(credits)}
          sub={earnedToday > 0 ? `+${earnedToday} today` : "no gains today"}
          accent="text-[var(--holo-amber)]"
          icon={<Coins className="size-3" />}
        />
      </div>

      <div ref={gridRef} className="grid gap-4 md:grid-cols-2">
        <ChartPanel label="Credit Flow · 14d" accent="cyan">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={creditDaily}>
              <defs>
                <linearGradient id="cr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--holo-cyan)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--holo-cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.17 200 / 0.08)" />
              <XAxis dataKey="day" {...AXIS} interval={1} />
              <YAxis {...AXIS} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} />
              <Area type="monotone" dataKey="credits" stroke="var(--holo-cyan)" strokeWidth={2} fill="url(#cr)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel label="Weekly Credit Yield" accent="amber">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={creditWeekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.17 200 / 0.08)" />
              <XAxis dataKey="week" {...AXIS} />
              <YAxis {...AXIS} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} cursor={{ fill: "oklch(0.85 0.17 200 / 0.06)" }} />
              <Bar dataKey="credits" fill="var(--holo-amber)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel label="Productivity Trend · 7d" accent="violet">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weekly}>
              <defs>
                <linearGradient id="p1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--holo-violet)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--holo-violet)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.17 200 / 0.08)" />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis {...AXIS} />
              <Tooltip {...CHART_TOOLTIP} />
              <Area type="monotone" dataKey="productivity" stroke="var(--holo-violet)" strokeWidth={2} fill="url(#p1)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel label="Namaz Consistency" accent="green">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.17 200 / 0.08)" />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis domain={[0, 5]} {...AXIS} />
              <Tooltip {...CHART_TOOLTIP} cursor={{ fill: "oklch(0.8 0.16 155 / 0.06)" }} />
              <Bar dataKey="prayers" fill="var(--holo-green)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel label="Mission Completion" accent="cyan">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={completion} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                <Cell fill="var(--holo-cyan)" />
                <Cell fill="oklch(1 1 1 / 0.1)" />
              </Pie>
              <Tooltip {...CHART_TOOLTIP} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-5 text-xs">
            <span className="flex items-center gap-1.5 text-foreground/80">
              <span className="size-2 rounded-full bg-[var(--holo-cyan)] shadow-[0_0_6px_1px_var(--holo-cyan)]" /> Done
            </span>
            <span className="flex items-center gap-1.5 text-foreground/80">
              <span className="size-2 rounded-full bg-[oklch(1_1_1/0.1)]" /> Open
            </span>
          </div>
        </ChartPanel>

        <ChartPanel label="Vizier Executive Brief" accent="violet" right={
          <Button size="sm" onClick={ask} disabled={busy}>
            <Sparkles className="size-3.5 mr-1" /> {busy ? "Analyzing…" : "Generate"}
          </Button>
        }>
          <div className="relative min-h-[180px] rounded-lg border border-[oklch(0.85_0.17_200/0.2)] bg-[oklch(0.1_0.02_260/0.4)] p-4 text-sm leading-relaxed whitespace-pre-wrap">
            <span className="pointer-events-none absolute left-0 top-0 size-2 border-l-2 border-t-2 border-[var(--holo-violet)/60]" />
            <span className="pointer-events-none absolute right-0 top-0 size-2 border-b-2 border-r-2 border-[var(--holo-violet)/60]" />
            {summary || (
              <span className="text-muted-foreground italic">
                Press Generate to receive a performance brief. Requires an OpenRouter API key in System Core.
              </span>
            )}
          </div>
        </ChartPanel>
      </div>
    </div>
  );
}
