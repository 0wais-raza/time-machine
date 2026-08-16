import { useApp, PRAYERS, todayStr, type ScheduleBlock } from "@/lib/store";
import { PanelHeader } from "../PanelHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { Flame, Target, CalendarClock, Moon, Coins, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNow, to12h } from "@/lib/clock";
import { useGsapReveal } from "@/hooks/useGsapReveal";

function activeOrNextBlock(blocks: ScheduleBlock[], now: Date) {
  const dow = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const todays = blocks
    .filter((b) => {
      const day =
        typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
      return day === dow;
    })
    .map((b) => {
      const [sh, sm] = b.start.split(":").map(Number);
      const [eh, em] = b.end.split(":").map(Number);
      return { ...b, startMins: sh * 60 + sm, endMins: eh * 60 + em };
    })
    .sort((a, b) => a.startMins - b.startMins);
  const active = todays.find((b) => mins >= b.startMins && mins < b.endMins);
  if (active) return { ...active, state: "active" as const };
  const upcoming = todays.find((b) => b.startMins >= mins);
  if (upcoming) return { ...upcoming, state: "upcoming" as const };
  return undefined;
}

function Radial({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} stroke="var(--color-border)" strokeWidth="10" fill="none" />
      <circle
        cx="70"
        cy="70"
        r={r}
        stroke="url(#g)"
        strokeWidth="10"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: "stroke-dashoffset .6s ease" }}
      />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-accent)" />
        </linearGradient>
      </defs>
      <text
        x="70"
        y="76"
        textAnchor="middle"
        fontSize="26"
        fontWeight="700"
        fill="var(--color-foreground)"
      >
        {value}%
      </text>
    </svg>
  );
}

export function DashboardTab() {
  const {
    tasks,
    blocks,
    prayers,
    prayerTimes,
    toggleTask,
    togglePrayer,
    credits,
    creditHistory,
    streak: persistedStreak,
  } = useApp();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const streak = mounted ? persistedStreak : 0;
  const today = todayStr();
  const todayPrayers = prayers[today] ?? {};
  const liveTimes = prayerTimes[today] ?? {};
  const done = tasks.filter((t) => t.done).length;
  const pct = Math.round((done / Math.max(1, tasks.length)) * 100);
  const top = [...tasks].filter((t) => !t.done).slice(0, 5);
  const now = useNow(1000);
  const nb = useMemo(() => (now ? activeOrNextBlock(blocks, now) : undefined), [blocks, now]);
  const earnedToday = creditHistory[today] ?? 0;
  const gridRef = useGsapReveal<HTMLDivElement>("dashboard");

  // Temporal: next prayer countdown.
  const nextPrayer = useMemo(() => {
    if (!now) return null;
    const mins = now.getHours() * 60 + now.getMinutes();
    for (const p of PRAYERS) {
      const t = liveTimes[p.name] ?? p.time;
      const [h, m] = t.split(":").map(Number);
      const total = h * 60 + m;
      if (total > mins) return { name: p.name, in: total - mins, time: t };
    }
    const first = PRAYERS[0];
    const t = liveTimes[first.name] ?? first.time;
    const [h, m] = t.split(":").map(Number);
    return { name: first.name, in: 24 * 60 - mins + h * 60 + m, time: t };
  }, [now, liveTimes]);
  const prayerETA = useMemo(() => {
    if (!nextPrayer || !now) return "--:--:--";
    const targetSec = nextPrayer.in * 60 - now.getSeconds();
    const hh = Math.floor(targetSec / 3600);
    const mm = Math.floor((targetSec % 3600) / 60);
    const ss = targetSec % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, [nextPrayer, now]);

  const eta = useMemo(() => {
    if (!nb || !now) return "--:--";
    const targetHHMM = nb.state === "active" ? nb.end : nb.start;
    const [h, m] = targetHHMM.split(":").map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    const diff = Math.max(0, target.getTime() - now.getTime());
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, [nb, now]);

  return (
    <div>
      <PanelHeader
        eyebrow="Command"
        title="Dashboard"
        subtitle="Today's operating picture, at a glance."
        right={
          <div className="glass-panel flex items-center gap-2 px-3.5 py-2">
            <Coins className="size-4 text-primary" />
            <span className="font-mono-tech text-lg font-bold tabular-nums">
              {mounted ? credits : 0}
            </span>
            <span className="text-xs text-muted-foreground">
              Cyber Credits{earnedToday > 0 ? ` · +${earnedToday} today` : ""}
            </span>
          </div>
        }
      />

      <div ref={gridRef} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-panel md:col-span-2 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Timer className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Next prayer</h3>
            {nextPrayer && (
              <span className="ml-auto text-xs text-muted-foreground">
                {nextPrayer.name} at {to12h(nextPrayer.time)}
              </span>
            )}
          </div>
          {nextPrayer ? (
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-semibold">{nextPrayer.name}</div>
              <div className="font-mono-tech text-4xl font-bold tabular-nums">{prayerETA}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Prayer times loading…</div>
          )}
        </div>

        <div className="glass-panel p-5 flex flex-col items-center justify-center text-center">
          <div className="mb-2 text-xs text-muted-foreground">Daily completion</div>
          <Radial value={pct} />
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Flame className="size-4 text-primary" />
            <span className="font-mono-tech">{streak}</span>
            <span className="text-muted-foreground">day streak</span>
          </div>
        </div>

        <div className="glass-panel md:col-span-2 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Priority queue</h3>
            <span className="ml-auto text-xs text-muted-foreground">{tasks.length - done} open</span>
          </div>
          <ul className="space-y-2">
            {top.length === 0 && (
              <li className="text-sm text-muted-foreground italic">Queue clear. Issue new directives.</li>
            )}
            {top.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2 transition hover:border-primary/50"
              >
                <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t.id)} />
                <span className="flex-1 text-sm">{t.title}</span>
                <PriorityChip p={t.priority} />
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel p-5 row-span-1">
          <div className="mb-4 flex items-center gap-2">
            <Moon className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Daily namaz</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {PRAYERS.filter((p) => todayPrayers[p.name]).length}/5
            </span>
          </div>
          <ul className="space-y-2">
            {PRAYERS.map((p) => (
              <li key={p.name} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!todayPrayers[p.name]}
                  onCheckedChange={() => togglePrayer(today, p.name)}
                />
                <span className="flex-1">{p.name}</span>
                <span className="font-mono-tech text-xs text-muted-foreground">
                  {to12h(liveTimes[p.name] ?? p.time)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Complete all five for a +5 credit bonus.
          </div>
        </div>

        <div className="glass-panel p-5 md:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="size-4 text-accent" />
            <h3 className="text-sm font-semibold">
              {nb?.state === "active" ? "Now running" : "Next block"}
            </h3>
            {nb?.state === "active" && (
              <span className="ml-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                Live
              </span>
            )}
          </div>
          {nb ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-semibold">{nb.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {to12h(nb.start)} → {to12h(nb.end)}
                  <span className="ml-2 text-[11px] text-muted-foreground/70">
                    {nb.state === "active" ? "ends in" : "starts in"}
                  </span>
                </div>
              </div>
              <div className="font-mono-tech text-4xl font-bold tabular-nums">{eta}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">No further scheduled blocks today.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function PriorityChip({ p }: { p: "low" | "medium" | "high" | "critical" }) {
  const map = {
    low: "border-border text-muted-foreground",
    medium: "border-primary/40 text-primary",
    high: "border-accent/50 text-accent",
    critical: "border-destructive/50 text-destructive",
  } as const;
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium capitalize ${map[p]}`}>
      {p}
    </span>
  );
}