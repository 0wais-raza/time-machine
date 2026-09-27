import { useEffect, useMemo, useState } from "react";
import { useApp, PRAYERS } from "@/lib/store";
import { PanelHeader } from "../PanelHeader";
import { HudLabel } from "../HudLabel";
import { Coins } from "lucide-react";
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
import { todayStr } from "@/lib/store";
import { useGsapReveal } from "@/hooks/useGsapReveal";
import { useCountUpValue } from "@/hooks/useGsapMotion";
import { cn } from "@/lib/utils";

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
    border: "1px solid oklch(0.62 0.19 260 / 0.25)",
    borderRadius: 10,
    fontSize: 12,
    backdropFilter: "blur(8px)",
  },
  labelStyle: { color: "oklch(0.9 0.02 260)" },
  itemStyle: { color: "var(--color-foreground)" },
} as const;

const AXIS = { stroke: "oklch(0.62 0.19 260 / 0.35)", fontSize: 10 } as const;

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
      <span className="pointer-events-none absolute left-0 top-0 size-2 border-l-2 border-t-2 border-[var(--accent)/50]" />
      <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className={cn("font-mono-tech text-[22px] font-bold tabular-nums leading-none", accent)}
        >
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
}: {
  label: string;
  accent?: "cyan" | "violet" | "amber" | "green";
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel relative p-5">
      <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--accent)/60]" />
      <span className="pointer-events-none absolute right-0 top-0 size-2.5 border-r-2 border-t-2 border-[var(--accent)/60]" />
      <span className="pointer-events-none absolute bottom-0 left-0 size-2.5 border-b-2 border-l-2 border-[var(--accent)/60]" />
      <span className="pointer-events-none absolute bottom-0 right-0 size-2.5 border-b-2 border-r-2 border-[var(--accent)/60]" />
      <div className="mb-4 flex items-center justify-between gap-3">
        <HudLabel accent={accent}>{label}</HudLabel>
      </div>
      {children}
    </div>
  );
}

export function AnalyticsTab() {
  const app = useApp();
  const tasks = Array.isArray(app.tasks) ? app.tasks : [];
  const prayers = app.prayers ?? {};
  const blocks = Array.isArray(app.blocks) ? app.blocks : [];
  const completedBlocks = app.completedBlocks ?? {};
  const creditHistory = app.creditHistory ?? {};
  const credits = app.credits ?? 0;
  const goals = app.goals ?? [];
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
    const today = todayStr();
    const todayP = prayers[today] ?? {};
    const prayerPct = Object.values(todayP).filter(Boolean).length / 5;
    const dow = new Date().getDay();
    const todays = blocks.filter((b) =>
      typeof b.dayOfWeek === "number" ? b.dayOfWeek === dow : b.date === today,
    );
    const doneIds = completedBlocks[today] ?? [];
    const adherence = todays.length ? doneIds.length / todays.length : 0;
    return Math.round((taskPct * 0.4 + adherence * 0.4 + prayerPct * 0.2) * 100);
  }, [tasks, prayers, blocks, completedBlocks]);

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

  // GSAP count-up telemetry (must sit after the memoized values they read).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const scoreAnim = useCountUpValue(score, { duration: 1.1, disabled: !mounted });
  const velocityAnim = useCountUpValue(velocity.pct, { duration: 1.1, disabled: !mounted });
  const creditsAnim = useCountUpValue(credits, { duration: 1.1, disabled: !mounted });

  // Local "weekly consistency" summary — pure math, no AI.
  const consistency = useMemo(() => {
    const last7 = lastNDays(7);
    const prayerDays = last7.filter(
      (d) => PRAYERS.filter((p) => prayers[d]?.[p.name]).length === 5,
    ).length;
    const taskDays = last7.filter((d) =>
      tasks.some((t) => t.done && t.completedAt?.slice(0, 10) === d),
    ).length;
    const bestDay = weekly.reduce(
      (best, w) => (w.productivity > best.productivity ? w : best),
      weekly[0] ?? { day: "—", productivity: 0 },
    );
    const lines: string[] = [];
    lines.push(
      prayerDays >= 5
        ? `Prayer discipline is elite — ${prayerDays}/7 full cycles this week.`
        : prayerDays >= 3
          ? `Prayer cycle hit ${prayerDays}/7 days — protect the weak windows.`
          : `Prayer cycle only ${prayerDays}/7 days this week — anchor the five windows first.`,
    );
    lines.push(
      taskDays >= 5
        ? `Task execution on ${taskDays}/7 days — momentum is real.`
        : `Task execution on ${taskDays}/7 days — one finished task per day keeps the streak alive.`,
    );
    if (bestDay?.productivity > 0)
      lines.push(`${bestDay.day} was your strongest day — schedule deep work there.`);
    const topGoal = goals.find((g) => (g.history[todayStr()] ?? 0) >= g.target);
    if (topGoal) lines.push(`Goal "${topGoal.title}" already hit today — banked.`);
    return lines;
  }, [prayers, tasks, weekly, goals]);

  return (
    <div>
      <PanelHeader
        eyebrow="Telemetry"
        title="Analytics"
        subtitle="Performance, consistency and credit flow — computed locally."
      />

      {/* Telemetry strip */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Productivity Score"
          value={`${Math.round(scoreAnim)}/100`}
          sub={score >= 70 ? "NOMINAL" : score >= 40 ? "STABLE" : "CRITICAL"}
          accent={
            score >= 70
              ? "text-[var(--holo-green)]"
              : score >= 40
                ? "text-[var(--accent)]"
                : "text-[var(--holo-pink)]"
          }
        />
        <Stat
          label="Execution Velocity"
          value={`${Math.round(velocityAnim)}%`}
          sub={`${velocity.done} done / ${velocity.planned} blocks`}
          accent="text-[var(--holo-violet)]"
        />
        <Stat
          label="Cyber Credits"
          value={String(Math.round(creditsAnim))}
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
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.62 0.19 260 / 0.08)" />
              <XAxis dataKey="day" {...AXIS} interval={1} />
              <YAxis {...AXIS} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} />
              <Area
                type="monotone"
                dataKey="credits"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#cr)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel label="Weekly Credit Yield" accent="amber">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={creditWeekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.62 0.19 260 / 0.08)" />
              <XAxis dataKey="week" {...AXIS} />
              <YAxis {...AXIS} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} cursor={{ fill: "oklch(0.62 0.19 260 / 0.06)" }} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.62 0.19 260 / 0.08)" />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis {...AXIS} />
              <Tooltip {...CHART_TOOLTIP} />
              <Area
                type="monotone"
                dataKey="productivity"
                stroke="var(--holo-violet)"
                strokeWidth={2}
                fill="url(#p1)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel label="Namaz Consistency" accent="green">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.62 0.19 260 / 0.08)" />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis {...AXIS} domain={[0, 5]} />
              <Tooltip {...CHART_TOOLTIP} cursor={{ fill: "oklch(0.8 0.16 155 / 0.06)" }} />
              <Bar dataKey="prayers" fill="var(--holo-green)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel label="Task Completion" accent="cyan">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={completion}
                dataKey="value"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                stroke="none"
              >
                <Cell fill="var(--accent)" />
                <Cell fill="oklch(1 1 1 / 0.1)" />
              </Pie>
              <Tooltip {...CHART_TOOLTIP} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-5 text-xs">
            <span className="flex items-center gap-1.5 text-foreground/80">
              <span className="size-2 rounded-full bg-[var(--accent)] shadow-[0_0_6px_1px_var(--accent)]" />{" "}
              Done
            </span>
            <span className="flex items-center gap-1.5 text-foreground/80">
              <span className="size-2 rounded-full bg-[oklch(1_1_1/0.1)]" /> Open
            </span>
          </div>
        </ChartPanel>

        <ChartPanel label="Weekly Consistency Brief" accent="violet">
          <ul className="min-h-[180px] space-y-2.5 rounded-lg border border-[oklch(0.62_0.19_260/0.2)] bg-[oklch(0.1_0.02_260/0.4)] p-4 text-sm leading-relaxed">
            {consistency.map((line, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <span className="text-foreground/85">{line}</span>
              </li>
            ))}
          </ul>
        </ChartPanel>
      </div>
    </div>
  );
}
