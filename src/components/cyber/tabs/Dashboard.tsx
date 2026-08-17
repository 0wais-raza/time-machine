import { useApp, PRAYERS, todayStr } from "@/lib/store";
import { HudLabel } from "../HudLabel";
import { Checkbox } from "@/components/ui/checkbox";
import { Coins, Timer, AlertTriangle, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNow, to12h } from "@/lib/clock";
import { JarvisClock } from "../JarvisClock";
import { cn } from "@/lib/utils";
import { partById } from "@/lib/hardware";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCountUpValue, useScanSweep, useTilt } from "@/hooks/useGsapMotion";

function Radial({ value, mounted }: { value: number; mounted: boolean }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const anim = useCountUpValue(value, { duration: 1.1, disabled: !mounted });
  const off = c - (anim / 100) * c;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
      <circle cx="50" cy="50" r={r} stroke="oklch(1 1 1 / 0.08)" strokeWidth="8" fill="none" />
      <circle
        cx="50"
        cy="50"
        r={r}
        stroke="url(#dashg)"
        strokeWidth="8"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dashoffset .25s linear" }}
      />
      <defs>
        <linearGradient id="dashg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--holo-cyan)" />
          <stop offset="100%" stopColor="var(--holo-violet)" />
        </linearGradient>
      </defs>
      <text
        x="50"
        y="56"
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fill="var(--color-foreground)"
      >
        {Math.round(anim)}%
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
    toggleTask,
    togglePrayer,
    credits,
    creditHistory,
    streak: persistedStreak,
    notificationsEnabled,
    equippedParts,
  } = useApp();
  const rigPowered = equippedParts.some((id) => partById(id)?.slot === "psu");
  const isMobile = useIsMobile();
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
  const prayerDone = PRAYERS.filter((p) => todayPrayers[p.name]).length;
  const earnedToday = creditHistory[today] ?? 0;

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

  // Live counters (GSAP count-up).
  const creditsAnim = useCountUpValue(mounted ? credits : 0, { duration: 1, disabled: !mounted });
  const streakAnim = useCountUpValue(streak, { duration: 1, disabled: !mounted });
  const earnedAnim = useCountUpValue(earnedToday, { duration: 1, disabled: !mounted });

  // Scan sweep across the JARVIS banner + priority queue.
  const bannerScan = useScanSweep<HTMLDivElement>(true, 5.5);
  const queueScan = useScanSweep<HTMLDivElement>(true, 7.5);

  const leftTilt = useTilt(5);
  const rightTilt = useTilt(5);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* JARVIS status banner */}
      <div
        ref={bannerScan.ref}
        className="corner-brackets glass-panel cyber-grid relative shrink-0 overflow-hidden px-5 py-3.5"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.85_0.17_200/0.5)] to-transparent" />
        {/* scanning beam */}
        <div
          ref={bannerScan.beamRef}
          className="pointer-events-none absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-[var(--holo-cyan)]/10 to-transparent"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--holo-cyan)]">
              J.A.R.V.I.S. // Command Hub
            </div>
            <div
              className="mt-1 text-lg font-bold leading-tight tracking-tight"
              suppressHydrationWarning
            >
              {greeting}, Sir — all systems nominal
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
            <StatusLine label="Core Online" on color="var(--holo-cyan)" />
            <StatusLine label="Broadcast" on={notificationsEnabled} color="var(--holo-green)" />
            <StatusLine label="Rig Powered" on={rigPowered} color="var(--holo-green)" />
            <span className="flex items-center gap-1.5 rounded-full border border-[oklch(0.82_0.16_80/0.25)] bg-[oklch(0.82_0.16_80/0.07)] px-2.5 py-1">
              <Coins className="size-3.5 text-[var(--holo-amber)]" />
              <span
                className="font-mono-tech text-sm font-bold tabular-nums text-[var(--holo-amber)]"
                suppressHydrationWarning
              >
                {Math.round(creditsAnim)}
              </span>
              <span className="text-[10px] text-muted-foreground">CR</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main JARVIS stage */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left — mission telemetry */}
        <div ref={leftTilt} className="flex flex-col gap-4 lg:col-span-3">
          <div className="glass-panel flex flex-col items-center justify-center gap-2 p-4">
            <HudLabel className="self-center">Mission Completion</HudLabel>
            <Radial value={pct} mounted={mounted} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="font-mono-tech text-base font-bold text-[var(--holo-amber)]"
                suppressHydrationWarning
              >
                {Math.round(streakAnim)}
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
                        "relative size-7 rounded-full border transition-all",
                        d
                          ? "border-[var(--holo-green)] bg-[oklch(0.8_0.16_155/0.15)] shadow-[0_0_10px_oklch(0.8_0.16_155/0.4)]"
                          : isNext
                            ? "border-[var(--holo-cyan)] bg-[oklch(0.85_0.17_200/0.12)]"
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
                            ? "text-[var(--holo-cyan)]"
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
              <span className="text-[var(--holo-amber)]">+5 CR bonus</span>
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
                +{Math.round(earnedAnim)}
              </span>
              <span className="text-xs text-muted-foreground">CR earned</span>
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
              Complete missions · blocks · namaz cycle
            </div>
          </div>
        </div>

        {/* Center — JARVIS clock */}
        <div className="relative flex items-center justify-center overflow-hidden lg:col-span-6">
          <div className="cyber-grid pointer-events-none absolute inset-0 opacity-50" />
          <JarvisClock size={isMobile ? 300 : 380} />
        </div>

        {/* Right — live beacons */}
        <div ref={rightTilt} className="flex flex-col gap-4 lg:col-span-3">
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
              Vizier Standing Orders
            </HudLabel>
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-foreground/80">
              <li className="flex gap-2">
                <span className="text-[var(--holo-cyan)]">▸</span> One mission at a time — deep
                focus.
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--holo-cyan)]">▸</span> Protect the namaz windows at all
                cost.
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--holo-cyan)]">▸</span> End the day with a 5/5 cycle
                &amp; banked credits.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Priority queue strip */}
      <div ref={queueScan.ref} className="glass-panel relative shrink-0 overflow-hidden p-4">
        <div
          ref={queueScan.beamRef}
          className="pointer-events-none absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-[var(--holo-violet)]/8 to-transparent"
        />
        <div className="mb-3 flex items-center justify-between">
          <HudLabel accent="violet">Priority Queue</HudLabel>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            {top.length} open · {done}/{tasks.length} executed
          </span>
        </div>
        {top.length === 0 ? (
          <div className="flex items-center gap-2 text-sm italic text-muted-foreground">
            <Zap className="size-3.5 text-[var(--holo-cyan)]" />
            Queue clear — issue new directives to J.A.R.V.I.S.
          </div>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {top.map((t) => {
              const overdue = t.dueDate && new Date(t.dueDate).getTime() < Date.now();
              return (
                <li
                  key={t.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition hover:border-[oklch(0.85_0.17_200/0.4)] hover:bg-[oklch(0.85_0.17_200/0.04)]",
                    t.priority === "critical"
                      ? "border-[oklch(0.72_0.24_350/0.35)] bg-[oklch(0.72_0.24_350/0.05)]"
                      : "border-[oklch(1_1_1/0.05)] bg-[oklch(1_1_1/0.02)]",
                  )}
                >
                  <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t.id)} />
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
    medium: "border-[oklch(0.85_0.17_200/0.4)] text-[var(--holo-cyan)]",
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
