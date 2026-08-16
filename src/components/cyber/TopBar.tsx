import { Flame, Bell, Coins } from "lucide-react";
import { useApp, PRAYERS, todayStr } from "@/lib/store";
import { Progress } from "@/components/ui/progress";
import { CommandClock } from "./CommandClock";
import { useNow } from "@/lib/clock";
import { computeStreak } from "@/lib/clock";
import { NotificationBell } from "./NotificationBell";

function nextPrayer(now: Date, dayTimes: Partial<Record<string, string>>) {
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
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-panel flex items-center gap-2 px-3 py-1.5 text-xs">
      {children}
    </div>
  );
}

export function TopBar() {
  const now = useNow(1000);
  const { tasks, prayers, profile, prayerTimes, credits } = useApp();
  const streak = computeStreak(tasks, prayers);
  const total = tasks.length || 1;
  const done = tasks.filter((t) => t.done).length;
  const pct = Math.round((done / total) * 100);

  const today = todayStr();
  const todayPrayers = prayers[today] ?? {};
  const prayerDone = PRAYERS.filter((p) => todayPrayers[p.name]).length;
  const dayTimes = prayerTimes[today] ?? {};

  const np = now ? nextPrayer(now, dayTimes) : { name: PRAYERS[0].name, in: 0 };
  const hh = Math.floor(np.in / 60).toString().padStart(2, "0");
  const mm = (np.in % 60).toString().padStart(2, "0");

  return (
    <header className="z-20 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-background/85 px-6 py-3 backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg flex items-center justify-center bg-[image:var(--gradient-cyber)] text-sm font-bold text-primary-foreground">
            CV
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">
              {profile?.name ? profile.name : "Operator"}
            </div>
            <div className="text-sm font-semibold tracking-tight">
              Chronos Vizier
            </div>
          </div>
        </div>
        <div className="hidden md:block">
          <CommandClock size={88} />
        </div>
        <div
          className="hidden lg:block text-xs text-muted-foreground"
          suppressHydrationWarning
        >
          {now
            ? now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
            : ""}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge>
          <Coins className="size-3.5 text-primary" />
          <span className="font-mono-tech" suppressHydrationWarning>{now ? credits : 0}</span>
          <span className="text-muted-foreground">credits</span>
        </Badge>

        <Badge>
          <Flame className="size-3.5 text-primary" />
          <span className="font-mono-tech" suppressHydrationWarning>{now ? streak : 0}</span>
          <span className="text-muted-foreground">streak</span>
        </Badge>

        <div className="glass-panel hidden sm:flex items-center gap-3 px-3 py-1.5">
          <span className="text-[11px] text-muted-foreground">Daily</span>
          <Progress value={pct} className="w-32 h-1.5" />
          <span className="font-mono-tech text-xs text-primary">{pct}%</span>
        </div>

        <Badge>
          <Bell className="size-3.5 text-accent" />
          <span className="text-muted-foreground">{np.name}</span>
          <span className="font-mono-tech">{hh}:{mm}</span>
        </Badge>

        <Badge>
          <span className="text-muted-foreground">Namaz</span>
          <span className="font-mono-tech text-primary">{prayerDone}/5</span>
        </Badge>

        <NotificationBell />
      </div>
    </header>
  );
}