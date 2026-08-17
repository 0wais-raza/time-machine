import {
  LayoutDashboard,
  Moon,
  ListChecks,
  CalendarClock,
  BarChart3,
  Cpu,
  Settings,
  Coins,
  Flame,
  Bot,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useApp, PRAYERS, todayStr, type TabKey } from "@/lib/store";
import { useNow, computeStreak } from "@/lib/clock";
import { resolveDayTimes } from "@/lib/prayerResolve";
import { NotificationBell } from "./NotificationBell";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Command Hub", icon: LayoutDashboard },
  { key: "namaz", label: "Spiritual Focus", icon: Moon },
  { key: "todo", label: "Task Matrix", icon: ListChecks },
  { key: "schedule", label: "Time Fortress", icon: CalendarClock },
  { key: "analytics", label: "Analytics Arcade", icon: BarChart3 },
  { key: "workbench", label: "Rig Armory", icon: Cpu },
  { key: "vizier", label: "J.A.R.V.I.S.", icon: Bot },
  { key: "settings", label: "System Core", icon: Settings },
];

export function HolographicNavBar() {
  const now = useNow(1000);
  const { activeTab, setActiveTab, tasks, prayers, prayerTimes, customPrayerTimes, credits } =
    useApp();
  // Derived streak is expensive (365-day scan) — only recompute when data changes,
  // not on the 1s clock tick that re-renders this header.
  const streak = useMemo(() => computeStreak(tasks, prayers), [tasks, prayers]);
  const today = todayStr();
  const todayPrayers = prayers[today] ?? {};
  const prayerDone = PRAYERS.filter((p) => todayPrayers[p.name]).length;
  const dayTimes = resolveDayTimes(prayerTimes, customPrayerTimes, today);

  // Next prayer countdown (compact).
  const np = (() => {
    if (!now) return null;
    const mins = now.getHours() * 60 + now.getMinutes();
    for (const p of PRAYERS) {
      const tStr = dayTimes[p.name] ?? p.time;
      const [h, m] = tStr.split(":").map(Number);
      const t = h * 60 + m;
      if (t > mins) return { name: p.name, in: t - mins };
    }
    const t0 = dayTimes[PRAYERS[0].name] ?? PRAYERS[0].time;
    const [h, m] = t0.split(":").map(Number);
    return { name: PRAYERS[0].name, in: 24 * 60 - mins + h * 60 + m };
  })();
  const npStr = np ? `${Math.floor(np.in / 60)}:${String(np.in % 60).padStart(2, "0")}` : "--:--";

  return (
    <header className="relative z-30 shrink-0 border-b border-[oklch(0.85_0.17_200/0.12)] bg-[oklch(0.08_0.02_270/0.8)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--holo-cyan)]/60 to-transparent" />

      <div className="relative flex h-14 items-center justify-between gap-3 px-4">
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex size-7 shrink-0 items-center justify-center">
            <div
              className="absolute inset-0 animate-[holo-spin_7s_linear_infinite] rounded-full border-2 border-[oklch(0.85_0.17_200/0.35)]"
              style={{ borderTopColor: "var(--holo-cyan)" }}
            />
            <div
              className="absolute inset-[4px] animate-[holo-spin-rev_5s_linear_infinite] rounded-full border border-[oklch(0.66_0.27_295/0.4)]"
              style={{ borderBottomColor: "var(--holo-violet)" }}
            />
            <span className="relative text-[10px] font-bold text-[var(--holo-cyan)]">CV</span>
          </div>
          <div className="hidden leading-none sm:block">
            <div className="text-[11px] font-bold tracking-[0.22em] text-foreground">
              J.A.R.V.I.S.
            </div>
            <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-[var(--holo-cyan)]/70">
              Chronos Vizier
            </div>
          </div>
        </div>

        {/* Centered circular tabs */}
        <nav className="no-scrollbar absolute left-1/2 top-1/2 flex max-w-[62vw] -translate-x-1/2 -translate-y-1/2 items-center gap-1 overflow-x-auto px-2 sm:gap-1.5">
          {NAV_ITEMS.map((it) => {
            const Icon = it.icon;
            const active = activeTab === it.key;
            return (
              <button
                key={it.key}
                title={it.label}
                aria-label={it.label}
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveTab(it.key)}
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-full border transition-all duration-200 md:size-9 xl:size-10",
                  active
                    ? "border-[var(--holo-cyan)] bg-[oklch(0.85_0.17_200/0.1)] text-[var(--holo-cyan)] shadow-[0_0_18px_oklch(0.85_0.17_200/0.35),inset_0_0_12px_oklch(0.85_0.17_200/0.12)]"
                    : "border-transparent text-muted-foreground hover:bg-[oklch(1_1_1/0.05)] hover:text-foreground",
                )}
              >
                {active && (
                  <span className="pointer-events-none absolute -inset-[3px] animate-[holo-spin_4s_linear_infinite] rounded-full border border-dashed border-[oklch(0.85_0.17_200/0.55)]" />
                )}
                <Icon className="size-[17px] md:size-[18px]" />
              </button>
            );
          })}
        </nav>

        {/* Telemetry */}
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 rounded-full border border-[oklch(0.85_0.17_200/0.12)] bg-[oklch(1_1_1/0.03)] px-3 py-1.5 xl:flex">
            <span
              className="font-mono-tech text-xs font-bold tabular-nums text-foreground"
              suppressHydrationWarning
            >
              {now
                ? `${String(now.getHours() % 12 || 12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
                : "--:--"}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--holo-cyan)]">
              {np?.name ?? ""} {npStr}
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-full border border-[oklch(0.82_0.16_80/0.22)] bg-[oklch(0.82_0.16_80/0.07)] px-2.5 py-1.5"
            title="Cyber Credits"
          >
            <Coins className="size-3.5 text-[var(--holo-amber)]" />
            <span
              className="font-mono-tech text-xs font-bold tabular-nums text-[var(--holo-amber)]"
              suppressHydrationWarning
            >
              {now ? credits : 0}
            </span>
          </div>
          <div
            className="hidden items-center gap-1.5 rounded-full border border-[oklch(0.8_0.16_155/0.22)] bg-[oklch(0.8_0.16_155/0.07)] px-2.5 py-1.5 md:flex"
            title="Streak"
          >
            <Flame className="size-3.5 text-[var(--holo-green)]" />
            <span
              className="font-mono-tech text-xs font-bold tabular-nums text-[var(--holo-green)]"
              suppressHydrationWarning
            >
              {now ? streak : 0}
            </span>
          </div>
          <div
            className="hidden items-center gap-1.5 rounded-full border border-[oklch(0.66_0.27_295/0.22)] bg-[oklch(0.66_0.27_295/0.07)] px-2.5 py-1.5 md:flex"
            title="Namaz"
          >
            <Moon className="size-3.5 text-[var(--holo-violet)]" />
            <span className="font-mono-tech text-xs font-bold tabular-nums text-[var(--holo-violet)]">
              {prayerDone}/5
            </span>
          </div>
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
