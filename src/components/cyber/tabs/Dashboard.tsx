import { useApp, PRAYERS, todayStr, type ScheduleBlock } from "@/lib/store";
import { PanelHeader } from "../PanelHeader";
import { HudLabel } from "../HudLabel";
import { Checkbox } from "@/components/ui/checkbox";
import { Coins } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNow, to12h } from "@/lib/clock";
import { useGsapReveal } from "@/hooks/useGsapReveal";
import { cn } from "@/lib/utils";

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
      <circle cx="70" cy="70" r={r} stroke="oklch(1 1 1 / 0.08)" strokeWidth="10" fill="none" />
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
          <stop offset="0%" stopColor="var(--holo-cyan)" />
          <stop offset="100%" stopColor="var(--holo-violet)" />
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

function Stat({
  label,
  value,
  sub,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="glass-panel px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
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
    if (!nb || !now) return "--:--:--";
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

  const prayerDone = PRAYERS.filter((p) => todayPrayers[p.name]).length;

  return (
    <div>
      <PanelHeader
        eyebrow="Command Hub"
        title="Tactical Overview"
        subtitle="Live operating picture — time, discipline and momentum at a glance."
        right={
          <div className="glass-panel flex items-center gap-2 px-3.5 py-2">
            <Coins className="size-4 text-[var(--holo-amber)]" />
            <span className="font-mono-tech text-lg font-bold tabular-nums text-[var(--holo-amber)]">
              {mounted ? credits : 0}
            </span>
            <span className="text-xs text-muted-foreground">
              CR{earnedToday > 0 ? ` · +${earnedToday} today` : ""}
            </span>
          </div>
        }
      />

      {/* Telemetry strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Next Prayer"
          value={nextPrayer?.name ?? "--"}
          sub={nextPrayer ? to12h(nextPrayer.time) : ""}
          accent="text-[var(--holo-cyan)]"
        />
        <Stat
          label={nb?.state === "active" ? "Block Ends" : "Block Starts"}
          value={nb ? nb.title.split(" ")[0] : "Open"}
          sub={nb ? to12h(nb.state === "active" ? nb.end : nb.start) : "no blocks"}
          accent="text-[var(--holo-violet)]"
        />
        <Stat
          label="Completion"
          value={`${pct}%`}
          sub={`${done}/${tasks.length} missions`}
          accent="text-[var(--holo-green)]"
        />
        <Stat label="Streak" value={String(streak)} sub="day streak" accent="text-[var(--holo-amber)]" />
        <Stat label="Namaz" value={`${prayerDone}/5`} sub="logged today" accent="text-[var(--holo-cyan)]" />
      </div>

      <div ref={gridRef} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Hero — completion radial */}
        <div className="glass-panel flex flex-col items-center justify-center p-5 text-center">
          <HudLabel className="mb-3 self-center">Mission Completion</HudLabel>
          <Radial value={pct} />
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="font-mono-tech text-lg font-bold text-[var(--holo-amber)]">{streak}</span>
            <span className="text-muted-foreground">day streak</span>
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
            {pct >= 100 ? "ALL DIRECTIVES EXECUTED" : pct >= 50 ? "HOLD THE LINE" : "INITIATE"}
          </div>
        </div>

        {/* Priority queue */}
        <div className="glass-panel p-5 md:col-span-2">
          <HudLabel accent="violet">Priority Queue</HudLabel>
          <ul className="mt-4 space-y-2">
            {top.length === 0 && (
              <li className="text-sm italic text-muted-foreground">
                Queue clear. Issue new directives.
              </li>
            )}
            {top.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-[oklch(1_1_1/0.05)] bg-[oklch(1_1_1/0.02)] px-3 py-2.5 transition hover:border-[oklch(0.85_0.17_200/0.35)] hover:bg-[oklch(0.85_0.17_200/0.04)]"
              >
                <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t.id)} />
                <span className="flex-1 text-sm text-foreground/90">{t.title}</span>
                <PriorityChip p={t.priority} />
              </li>
            ))}
          </ul>
        </div>

        {/* Next prayer — live countdown */}
        <div className="glass-panel p-5">
          <HudLabel accent="green">Next Prayer</HudLabel>
          {nextPrayer ? (
            <div className="mt-4 flex flex-col items-start gap-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold tracking-tight">{nextPrayer.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {to12h(nextPrayer.time)}
                </span>
              </div>
              <div className="font-mono-tech text-3xl font-bold tabular-nums text-[var(--holo-cyan)]">
                {prayerETA}
              </div>
              <div className="mt-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70">
                <span className="led-dot size-1.5" style={{ color: "var(--holo-green)" }} />
                Countdown locked
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm italic text-muted-foreground">Prayer times loading…</div>
          )}
        </div>

        {/* Daily namaz */}
        <div className="glass-panel p-5">
          <HudLabel accent="cyan">Daily Namaz</HudLabel>
          <ul className="mt-4 space-y-2.5">
            {PRAYERS.map((p) => (
              <li key={p.name} className="flex items-center gap-2.5 text-sm">
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
          <div className="mt-4 border-t border-[oklch(1_1_1/0.06)] pt-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            Full cycle +5 CR bonus
          </div>
        </div>

        {/* Schedule beacon */}
        <div className="glass-panel p-5">
          <HudLabel accent="amber">Schedule Beacon</HudLabel>
          {nb ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-lg font-semibold">{nb.title}</span>
                {nb.state === "active" && (
                  <span className="shrink-0 rounded-full border border-[var(--holo-green)]/40 bg-[oklch(0.8_0.16_155/0.1)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--holo-green)]">
                    Live
                  </span>
                )}
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {to12h(nb.start)} → {to12h(nb.end)}
              </div>
              <div className="mt-3 font-mono-tech text-3xl font-bold tabular-nums text-[var(--holo-amber)]">
                {eta}
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70">
                {nb.state === "active" ? "ends in" : "starts in"}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm italic text-muted-foreground">
              No scheduled blocks today — open territory.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PriorityChip({ p }: { p: "low" | "medium" | "high" | "critical" }) {
  const map = {
    low: "border-[oklch(1_1_1/0.1)] text-muted-foreground",
    medium: "border-[oklch(0.85_0.17_200/0.4)] text-[var(--holo-cyan)]",
    high: "border-[oklch(0.66_0.27_295/0.5)] text-[var(--holo-violet)]",
    critical: "border-[oklch(0.72_0.24_350/0.5)] text-[var(--holo-pink)]",
  } as const;
  return (
    <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium capitalize ${map[p]}`}>
      {p}
    </span>
  );
}
