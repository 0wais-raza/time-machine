import { useEffect, useMemo, useState } from "react";
import { useApp, PRAYERS, todayStr } from "@/lib/store";
import { HudLabel } from "../HudLabel";
import { Checkbox } from "@/components/ui/checkbox";
import { Coins, Timer, AlertTriangle, Target, Play, BellRing } from "lucide-react";
import { useNow, to12h } from "@/lib/clock";
import { CommandClock } from "../CommandClock";
import { TodayTimeline } from "../TodayTimeline";
import { cn } from "@/lib/utils";
import { partById } from "@/lib/hardware";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolveDayTimes } from "@/lib/prayerResolve";
import { DailyGoals } from "../DailyGoals";
import { ExamCountdownStrip } from "../StudyPlanner";

/**
 * Command Hub — redesigned around one question: "what should I be doing now?"
 *
 * Layout priority:
 *   1. Clock + today's timeline (the answer, always visible)
 *   2. Next actions (prayer cycle, next block, open missions)
 *   3. Ambient telemetry (goals, system pulse) — quiet, at the bottom
 */

function Radial({ value, mounted }: { value: number; mounted: boolean }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const pct = mounted ? value : 0;
  const off = c - (pct / 100) * c;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
      <circle cx="50" cy="50" r={r} stroke="oklch(1 1 1 / 0.08)" strokeWidth="8" fill="none" />
      <circle
        cx="50"
        cy="50"
        r={r}
        stroke="currentColor"
        strokeWidth="8"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        className="text-accent"
        style={{ transition: "stroke-dashoffset .4s ease" }}
      />
      <text
        x="50"
        y="56"
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fill="var(--color-foreground)"
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function StatusLine({ label, on, color }: { label: string; on: boolean; color: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em]">
      <span
        className={cn("size-1.5 rounded-full", on && "led-dot")}
        style={on ? { color } : { background: "#3a4552" }}
      />
      <span className={on ? "text-foreground/85" : "text-muted-foreground/50"}>{label}</span>
    </span>
  );
}

export function DashboardTab() {
  const {
    tasks,
    blocks,
    prayers,
    prayerTimes,
    customPrayerTimes,
    togglePrayer,
    credits,
    streak,
    notificationsEnabled,
    equippedParts,
    setActiveTab,
    bridgeEnabled,
    bridgeStatus,
  } = useApp();
  const rigPowered = equippedParts.some((id) => partById(id)?.slot === "psu");
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const today = todayStr();
  const todayPrayers = prayers[today] ?? {};
  const liveTimes = resolveDayTimes(prayerTimes, customPrayerTimes, today);
  const done = tasks.filter((t) => t.done).length;
  const pct = Math.round((done / Math.max(1, tasks.length)) * 100);
  const top = [...tasks].filter((t) => !t.done).slice(0, 5);
  const now = useNow(1000);
  const prayerDone = PRAYERS.filter((p) => todayPrayers[p.name]).length;
  const earnedToday = useApp((s) => s.creditHistory[today] ?? 0);

  // Next prayer countdown.
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
    return { name: first.name, in: 24 * 60 - mins + h * 60 + m, time: t, tomorrow: true };
  }, [now, liveTimes]);
  const prayerETA = useMemo(() => {
    if (!nextPrayer || !now) return "--:--:--";
    const targetSec = nextPrayer.in * 60 - now.getSeconds();
    const hh = Math.floor(targetSec / 3600);
    const mm = Math.floor((targetSec % 3600) / 60);
    const ss = targetSec % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, [nextPrayer, now]);

  // Today's blocks (for the beacon card under the clock).
  const beacon = useMemo(() => {
    if (!now) return null;
    const mins = now.getHours() * 60 + now.getMinutes();
    const dow = now.getDay();
    const todays = blocks
      .filter((b) => {
        const d = typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
        return d === dow;
      })
      .map((b) => {
        const [sh, sm] = b.start.split(":").map(Number);
        const [eh, em] = b.end.split(":").map(Number);
        return { ...b, sM: sh * 60 + sm, eM: eh * 60 + em };
      })
      .sort((a, b) => a.sM - b.sM);
    const active = todays.find((b) => mins >= b.sM && mins < b.eM);
    if (active) return { ...active, state: "active" as const };
    const upcoming = todays.find((b) => b.sM >= mins);
    if (upcoming) return { ...upcoming, state: "upcoming" as const };
    return null;
  }, [blocks, now]);

  const beaconETA = useMemo(() => {
    if (!beacon || !now) return null;
    const targetHHMM = beacon.state === "active" ? beacon.end : beacon.start;
    const [h, m] = targetHHMM.split(":").map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    const diff = Math.max(0, target.getTime() - now.getTime());
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, [beacon, now]);

  const hour = now?.getHours() ?? 0;
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Next exam subject for the hero strip.
  const nextExam = useMemo(() => {
    return [...useApp.getState().examSubjects]
      .map((s) => ({
        s,
        d: s.examDate
          ? Math.ceil((new Date(s.examDate + "T23:59:59").getTime() - Date.now()) / 86400000)
          : null,
      }))
      .filter((x) => x.d !== null && x.d >= 0)
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))[0];
  }, [mounted]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* ══ HERO — greeting + real system status (nothing fake) ══ */}
      <div className="glass-panel relative shrink-0 overflow-hidden px-5 py-4">
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--accent)]">
              Command Hub
            </div>
            <div
              className="mt-1 text-xl font-bold leading-tight tracking-tight"
              suppressHydrationWarning
            >
              {greeting}
            </div>
            <div
              className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground"
              suppressHydrationWarning
            >
              {now
                ? now.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : ""}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <StatusLine
              label="Bridge"
              on={bridgeEnabled && bridgeStatus === "online"}
              color="var(--holo-green)"
            />
            <StatusLine label="Rig" on={rigPowered} color="var(--holo-green)" />
            {nextExam && <ExamCountdownStrip />}
            <span className="flex items-center gap-1.5 rounded-full border border-[oklch(0.82_0.16_80/0.25)] bg-[oklch(0.82_0.16_80/0.07)] px-2.5 py-1">
              <Coins className="size-3.5 text-[var(--holo-amber)]" />
              <span
                className="font-mono-tech text-sm font-bold tabular-nums text-[var(--holo-amber)]"
                suppressHydrationWarning
              >
                {credits}
              </span>
              <span className="text-[10px] text-muted-foreground">CR</span>
            </span>
          </div>
        </div>
      </div>

      {/* ══ MAIN STAGE — clock + today's timeline (the focus zone) ══ */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Center-first on mobile via order; desktop: left stats, center clock+timeline */}
        <div className="order-2 flex flex-col gap-4 lg:order-1 lg:col-span-3">
          <div className="glass-panel flex flex-col items-center justify-center gap-2 p-4">
            <HudLabel className="self-center">Mission Completion</HudLabel>
            <Radial value={pct} mounted={mounted} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="font-mono-tech text-base font-bold text-[var(--holo-amber)]"
                suppressHydrationWarning
              >
                {streak}
              </span>
              day streak
            </div>
          </div>
          <div className="glass-panel p-4">
            <HudLabel accent="green" className="mb-3">
              Daily Namaz Cycle
            </HudLabel>
            <div className="flex items-center justify-between">
              {PRAYERS.map((p) => {
                const d = !!todayPrayers[p.name];
                const isNext = nextPrayer?.name === p.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => togglePrayer(today, p.name)}
                    className="flex flex-col items-center gap-1.5"
                    title={`${p.name} — ${to12h(liveTimes[p.name] ?? p.time)}`}
                  >
                    <span
                      className={cn(
                        "relative size-7 rounded-full border transition-all duration-200",
                        d
                          ? "border-[var(--holo-green)] bg-[oklch(0.8_0.16_155/0.15)] shadow-[0_0_10px_oklch(0.8_0.16_155/0.4)]"
                          : isNext
                            ? "border-[var(--accent)] bg-[oklch(0.62_0.19_260/0.12)]"
                            : "border-[oklch(1_1_1/0.12)] bg-[oklch(1_1_1/0.03)]",
                      )}
                    >
                      {d && (
                        <span className="flex h-full items-center justify-center text-[10px] text-[var(--holo-green)]">
                          ✓
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[8px] uppercase tracking-wider",
                        d
                          ? "text-[var(--holo-green)]"
                          : isNext
                            ? "text-[var(--accent)]"
                            : "text-muted-foreground/60",
                      )}
                    >
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[oklch(1_1_1/0.06)] pt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
              <span>Cycle {prayerDone}/5</span>
              <span className="text-[var(--holo-amber)]">+1 CR · full cycle +10</span>
            </div>
          </div>
          <div className="glass-panel p-4">
            <HudLabel accent="amber" className="mb-2">
              Credits Today
            </HudLabel>
            <div className="flex items-baseline gap-2">
              <span
                className="font-mono-tech text-3xl font-bold tabular-nums text-[var(--holo-amber)]"
                suppressHydrationWarning
              >
                +{earnedToday}
              </span>
              <span className="text-xs text-muted-foreground">CR earned</span>
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
              Missions · blocks · namaz cycle
            </div>
          </div>
        </div>

        {/* Clock + timeline — the actual focus zone */}
        <div className="order-1 flex flex-col items-center justify-center gap-5 py-2 lg:order-2 lg:col-span-6">
          <CommandClock size={isMobile ? 280 : 340} />
          <div className="w-full max-w-[520px]">
            <TodayTimeline />
          </div>
        </div>

        {/* Right — live beacons */}
        <div className="order-3 flex flex-col gap-4 lg:col-span-3">
          <div className="glass-panel p-4">
            <HudLabel accent="amber" className="mb-2">
              Schedule Beacon
            </HudLabel>
            {beacon ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-base font-semibold">{beacon.title}</span>
                  {beacon.state === "active" && (
                    <span className="shrink-0 rounded-full border border-[var(--holo-green)]/40 bg-[oklch(0.8_0.16_155/0.1)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--holo-green)]">
                      Live
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {to12h(beacon.start)} → {to12h(beacon.end)}
                </div>
                <div
                  className="mt-2 font-mono-tech text-3xl font-bold tabular-nums text-[var(--holo-amber)]"
                  suppressHydrationWarning
                >
                  {beaconETA ?? "--:--:--"}
                </div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70">
                  {beacon.state === "active" ? "ends in" : "starts in"}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm italic text-muted-foreground">
                No scheduled blocks today — open territory.
              </div>
            )}
          </div>

          <div className="glass-panel p-4">
            <HudLabel accent="green" className="mb-2">
              Next Prayer
            </HudLabel>
            {nextPrayer ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{nextPrayer.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {to12h(nextPrayer.time)}
                  </span>
                </div>
                <div
                  className="mt-1 font-mono-tech text-3xl font-bold tabular-nums text-[var(--holo-green)]"
                  suppressHydrationWarning
                >
                  {prayerETA}
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70">
                  {nextPrayer.tomorrow ? "tomorrow" : "countdown locked"}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm italic text-muted-foreground">Loading prayer times…</div>
            )}
          </div>

          <div className="glass-panel p-4">
            <HudLabel accent="cyan" className="mb-2">
              Standing Orders
            </HudLabel>
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-foreground/80">
              <li className="flex gap-2">
                <span className="text-[var(--accent)]">▸</span> One mission at a time — deep focus.
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--accent)]">▸</span> Protect the namaz windows.
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--accent)]">▸</span> End the day with a 5/5 cycle banked.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ══ LOWER DECK — goals + system pulse ══ */}
      <div className="grid shrink-0 grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <DailyGoals compact />
        </div>
        <div className="glass-panel flex flex-col justify-center p-4 xl:col-span-5">
          <HudLabel accent="green" className="mb-2">
            System Pulse
          </HudLabel>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div
                className="font-mono-tech text-xl font-bold tabular-nums text-[var(--accent)]"
                suppressHydrationWarning
              >
                {tasks.filter((t) => !t.done).length}
              </div>
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                Open missions
              </div>
            </div>
            <div>
              <div
                className="font-mono-tech text-xl font-bold tabular-nums text-[var(--holo-violet)]"
                suppressHydrationWarning
              >
                {
                  blocks.filter((b) => {
                    const d =
                      typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
                    return d === (now?.getDay() ?? 0);
                  }).length
                }
              </div>
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                Blocks today
              </div>
            </div>
            <div>
              <div
                className="font-mono-tech text-xl font-bold tabular-nums text-[var(--holo-green)]"
                suppressHydrationWarning
              >
                {prayerDone}/5
              </div>
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                Namaz cycle
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 border-t border-[oklch(1_1_1/0.06)] pt-2.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
            <BellRing className="size-3" />
            {notificationsEnabled ? "Broadcast live" : "Broadcast offline — arm in System Core"}
          </div>
        </div>
      </div>

      {/* ══ Priority queue strip ══ */}
      <div className="glass-panel relative shrink-0 p-4">
        <div className="mb-3 flex items-center justify-between">
          <HudLabel accent="violet">Priority Queue</HudLabel>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            {top.length} open · {done}/{tasks.length} done
          </span>
        </div>
        {top.length === 0 ? (
          <div className="flex items-center gap-2 text-sm italic text-muted-foreground">
            <Target className="size-3.5 text-[var(--accent)]" />
            Queue clear — add your next mission in Task Control.
          </div>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {top.map((t) => {
              const overdue = t.dueDate && new Date(t.dueDate).getTime() < Date.now();
              return (
                <li
                  key={t.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition hover:border-[oklch(0.62_0.19_260/0.4)] hover:bg-[oklch(0.62_0.19_260/0.04)]",
                    t.priority === "critical"
                      ? "border-[oklch(0.72_0.24_350/0.35)] bg-[oklch(0.72_0.24_350/0.05)]"
                      : "border-[oklch(1_1_1/0.05)] bg-[oklch(1_1_1/0.02)]",
                  )}
                >
                  <Checkbox
                    checked={t.done}
                    onCheckedChange={() => useApp.getState().toggleTask(t.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground/90">{t.title}</div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <PriorityChip p={t.priority} />
                      {overdue && (
                        <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-[var(--holo-pink)]">
                          <AlertTriangle className="size-3" /> overdue
                        </span>
                      )}
                      {typeof t.estimatedMinutes === "number" && !t.done && (
                        <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
                          <Timer className="size-3" /> {t.estimatedMinutes}m
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("todo")}
                    className="shrink-0 rounded p-1 text-muted-foreground/50 transition hover:text-[var(--accent)]"
                    title="Open Mission Control"
                  >
                    <Play className="size-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PriorityChip({ p }: { p: "low" | "medium" | "high" | "critical" }) {
  const map = {
    low: "border-[oklch(1_1_1/0.1)] text-muted-foreground",
    medium: "border-[oklch(0.62_0.19_260/0.4)] text-[var(--accent)]",
    high: "border-[oklch(0.66_0.27_295/0.5)] text-[var(--holo-violet)]",
    critical: "border-[oklch(0.72_0.24_350/0.5)] text-[var(--holo-pink)]",
  } as const;
  return (
    <span
      className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium capitalize ${map[p]}`}
    >
      {p}
    </span>
  );
}
