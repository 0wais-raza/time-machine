import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
  MapPin,
  RefreshCw,
  Moon,
} from "lucide-react";
import { useApp, PRAYERS, todayStr } from "@/lib/store";
import { PanelHeader } from "../PanelHeader";
import { HudLabel } from "../HudLabel";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { to12h, useNow } from "@/lib/clock";
import { fetchPrayerTimes, requestGeo } from "@/lib/prayerTimes";
import { toast } from "sonner";

// Approximate Hijri conversion (Umm al-Qura algorithm approximation)
function toHijri(date: Date): { day: number; month: string; year: number } {
  const months = [
    "Muharram",
    "Safar",
    "Rabi' al-Awwal",
    "Rabi' al-Thani",
    "Jumada al-Awwal",
    "Jumada al-Thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ];
  const jd = Math.floor((date.getTime() - Date.UTC(1970, 0, 1)) / 86400000) + 2440588;
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
    Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 =
    l2 -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const m = Math.floor((24 * l3) / 709);
  const d = l3 - Math.floor((709 * m) / 24);
  const y = 30 * n + j - 30;
  return { day: d, month: months[m - 1] ?? months[0], year: y };
}

export function NamazTab() {
  const { prayers, togglePrayer, prayerTimes, setDayPrayerTimes, coords, setCoords } = useApp();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [editPast, setEditPast] = useState(false);
  const [loading, setLoading] = useState(false);
  const dayPrayers = prayers[selectedDate] ?? {};
  const hijri = useMemo(() => toHijri(new Date(selectedDate)), [selectedDate]);
  const liveTimes = prayerTimes[selectedDate] ?? {};
  const now = useNow(1000);
  const today = todayStr();

  const days = useMemo(() => {
    const arr: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, []);

  const loadTimes = async (date: string, c: { lat: number; lon: number } | null) => {
    if (!c) return;
    setLoading(true);
    try {
      const map = await fetchPrayerTimes(new Date(date), c.lat, c.lon);
      setDayPrayerTimes(date, map);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Prayer fetch failed");
    } finally {
      setLoading(false);
    }
  };

  const enableGeo = async () => {
    try {
      const c = await requestGeo();
      setCoords(c);
      await loadTimes(selectedDate, c);
      toast.success("Prayer times calibrated to your location.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Location denied");
    }
  };

  // Auto-fetch when date changes if we have coords and no cache yet.
  useEffect(() => {
    if (!coords) return;
    if (prayerTimes[selectedDate]) return;
    loadTimes(selectedDate, coords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, coords]);

  const shiftDate = (n: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + n);
    setSelectedDate(d.toISOString().slice(0, 10));
  };
  const isToday = selectedDate === today;
  const isPast = selectedDate < today;
  const locked = isPast && !editPast;

  const doneCount = PRAYERS.filter((p) => dayPrayers[p.name]).length;

  // Live next-prayer beacon (only meaningful for today).
  const nextPrayer = useMemo(() => {
    if (!now || selectedDate !== today) return null;
    const mins = now.getHours() * 60 + now.getMinutes();
    for (const p of PRAYERS) {
      const t = liveTimes[p.name] ?? p.time;
      const [h, m] = t.split(":").map(Number);
      if (h * 60 + m > mins) return { name: p.name, time: t };
    }
    const first = PRAYERS[0];
    const t = liveTimes[first.name] ?? first.time;
    return { name: first.name, time: t, tomorrow: true };
  }, [now, liveTimes, selectedDate, today]);

  const nextCountdown = useMemo(() => {
    if (!now || !nextPrayer) return null;
    const [h, m] = nextPrayer.time.split(":").map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (nextPrayer.tomorrow) target.setDate(target.getDate() + 1);
    const diff = Math.max(0, Math.round((target.getTime() - now.getTime()) / 1000));
    const hh = Math.floor(diff / 3600);
    const mm = Math.floor((diff % 3600) / 60);
    const ss = diff % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, [now, nextPrayer]);

  const greg = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div>
      <PanelHeader
        eyebrow="Spiritual Focus"
        title="Namaz Discipline"
        subtitle="Five pillars. Zero compromise."
      />

      {/* Hero — Hijri clock + live countdown + cycle ring */}
      <div className="glass-panel cyber-grid corner-brackets relative mb-4 overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.85_0.17_200/0.5)] to-transparent" />
        <div className="relative grid gap-5 md:grid-cols-3">
          {/* Hijri */}
          <div>
            <HudLabel accent="cyan" className="mb-2">
              Hijri Date
            </HudLabel>
            <div className="text-3xl font-bold tracking-tight">
              {hijri.day} {hijri.month}
            </div>
            <div className="font-mono text-sm text-[var(--holo-cyan)]">{hijri.year} AH</div>
            <div className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {greg}
            </div>
          </div>
          {/* Live countdown */}
          <div className="flex flex-col justify-center md:border-l md:border-[oklch(1_1_1/0.07)] md:pl-5">
            <HudLabel accent="green" className="mb-2">
              {nextPrayer?.tomorrow ? "Next (tomorrow)" : "Next Prayer"}
            </HudLabel>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold">{nextPrayer?.name ?? PRAYERS[0].name}</span>
              <span className="font-mono text-sm text-muted-foreground">
                {nextPrayer ? to12h(nextPrayer.time) : ""}
              </span>
            </div>
            <div
              className="mt-1 font-mono-tech text-4xl font-bold tabular-nums text-[var(--holo-green)]"
              suppressHydrationWarning
            >
              {nextCountdown ?? "--:--:--"}
            </div>
            <div className="mt-1.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70">
              <span className="led-dot size-1.5" style={{ color: "var(--holo-green)" }} />
              {now?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} local time
            </div>
          </div>
          {/* Cycle ring */}
          <div className="flex flex-col items-center justify-center gap-2 md:border-l md:border-[oklch(1_1_1/0.07)] md:pl-5">
            <div className="flex items-center gap-3">
              {PRAYERS.map((p) => {
                const done = !!dayPrayers[p.name];
                const isNext = nextPrayer?.name === p.name;
                return (
                  <div key={p.name} className="flex flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        "relative size-7 rounded-full border transition-all",
                        done
                          ? "border-[var(--holo-green)] bg-[oklch(0.8_0.16_155/0.15)] shadow-[0_0_10px_oklch(0.8_0.16_155/0.4)]"
                          : isNext
                            ? "border-[var(--holo-cyan)] bg-[oklch(0.85_0.17_200/0.12)]"
                            : "border-[oklch(1_1_1/0.12)] bg-[oklch(1_1_1/0.03)]",
                      )}
                    >
                      {isNext && (
                        <span className="pointer-events-none absolute -inset-[3px] animate-[holo-spin_3s_linear_infinite] rounded-full border border-dashed border-[oklch(0.85_0.17_200/0.6)]" />
                      )}
                      {done && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--holo-green)]">
                          ✓
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[8px] uppercase tracking-wider",
                        done
                          ? "text-[var(--holo-green)]"
                          : isNext
                            ? "text-[var(--holo-cyan)]"
                            : "text-muted-foreground/60",
                      )}
                    >
                      {p.name}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Cycle {doneCount}/5 {doneCount === 5 && "· +5 CR bonus ✓"}
            </div>
          </div>
        </div>
      </div>

      {/* Day controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[oklch(1_1_1/0.06)] bg-[oklch(1_1_1/0.02)] px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="ghost" onClick={() => shiftDate(-1)} title="Previous day">
            <ChevronLeft className="size-4" />
          </Button>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded border border-border bg-background/60 px-2 py-1 font-mono text-xs"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => shiftDate(1)}
            disabled={isToday}
            title="Next day"
          >
            <ChevronRight className="size-4" />
          </Button>
          {isPast && (
            <Button
              size="sm"
              variant={editPast ? "default" : "secondary"}
              onClick={() => setEditPast((v) => !v)}
              className="ml-1 text-[11px]"
            >
              <HistoryIcon className="size-3.5 mr-1" />
              {editPast ? "Editing past" : "Edit past"}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {coords ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => loadTimes(selectedDate, coords)}
              disabled={loading}
              title="Refresh times"
              className="text-[11px]"
            >
              <RefreshCw className={cn("size-3.5 mr-1", loading && "animate-spin")} />
              {coords.lat.toFixed(2)}, {coords.lon.toFixed(2)}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={enableGeo} className="text-[11px]">
              <MapPin className="size-3.5 mr-1" /> Enable live times
            </Button>
          )}
        </div>
      </div>

      {/* Prayer cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PRAYERS.map((p) => {
          const done = !!dayPrayers[p.name];
          const isNext = nextPrayer?.name === p.name;
          const t = liveTimes[p.name] ?? p.time;
          return (
            <button
              key={p.name}
              onClick={() => !locked && togglePrayer(selectedDate, p.name)}
              className={cn(
                "glass-panel relative flex flex-col items-center gap-2 overflow-hidden p-4 text-center transition-all hover:-translate-y-0.5",
                done
                  ? "border-[oklch(0.8_0.16_155/0.45)] shadow-[0_0_22px_oklch(0.8_0.16_155/0.15)]"
                  : isNext
                    ? "border-[oklch(0.85_0.17_200/0.5)] shadow-[0_0_22px_oklch(0.85_0.17_200/0.2)]"
                    : "hover:border-[oklch(0.85_0.17_200/0.3)]",
              )}
            >
              {isNext && (
                <span className="pointer-events-none absolute -inset-[2px] animate-[holo-spin_4s_linear_infinite] rounded-[inherit] border border-dashed border-[oklch(0.85_0.17_200/0.45)]" />
              )}
              <Moon
                className={cn(
                  "size-5",
                  done
                    ? "text-[var(--holo-green)]"
                    : isNext
                      ? "text-[var(--holo-cyan)]"
                      : "text-muted-foreground/60",
                )}
              />
              <div className="text-sm font-bold">{p.name}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {to12h(t)}
                {liveTimes[p.name] && (
                  <span className="ml-1 text-[8px] uppercase tracking-widest text-[var(--holo-cyan)]">
                    live
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "mt-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] transition",
                  done
                    ? "border-[oklch(0.8_0.16_155/0.4)] bg-[oklch(0.8_0.16_155/0.1)] text-[var(--holo-green)]"
                    : isNext
                      ? "border-[oklch(0.85_0.17_200/0.4)] bg-[oklch(0.85_0.17_200/0.1)] text-[var(--holo-cyan)]"
                      : "border-border text-muted-foreground/70",
                )}
              >
                {done ? "Logged ✓" : isNext ? "Next" : locked ? "Locked" : "Pending"}
              </div>
            </button>
          );
        })}
      </div>

      {/* History — compact horizontal heat-strip (scannable, one row) */}
      <div className="glass-panel p-4">
        <HudLabel accent="violet" className="mb-3">
          14-Day History
        </HudLabel>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {days.map((d) => {
            const count = PRAYERS.filter((p) => prayers[d]?.[p.name]).length;
            const isSel = d === selectedDate;
            const isToday = d === today;
            const dow = new Date(d + "T12:00:00")
              .toLocaleDateString("en-US", { weekday: "short" })
              .slice(0, 2)
              .toUpperCase();
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={cn(
                  "group relative flex w-[46px] shrink-0 flex-col items-center gap-1 rounded-md border px-1.5 py-2 transition-all",
                  isSel
                    ? "border-[var(--holo-cyan)] bg-[oklch(0.85_0.17_200/0.12)] shadow-[0_0_14px_oklch(0.85_0.17_200/0.3)]"
                    : "border-[oklch(1_1_1/0.06)] bg-[oklch(1_1_1/0.015)] hover:border-[oklch(0.85_0.17_200/0.35)] hover:bg-[oklch(0.85_0.17_200/0.05)]",
                )}
              >
                <span className="flex items-center gap-1">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/60">
                    {dow}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold tabular-nums",
                      isSel
                        ? "text-[var(--holo-cyan)]"
                        : isToday
                          ? "text-[var(--holo-green)]"
                          : "text-foreground/85",
                    )}
                  >
                    {new Date(d).getDate()}
                  </span>
                </span>
                {/* 5-segment prayer progress */}
                <span className="flex gap-[2px]">
                  {PRAYERS.map((p) => {
                    const on = !!prayers[d]?.[p.name];
                    return (
                      <span
                        key={p.name}
                        className={cn(
                          "h-3 w-[5px] rounded-[1px] transition-all",
                          on
                            ? isSel
                              ? "bg-[var(--holo-cyan)] shadow-[0_0_5px_oklch(0.85_0.17_200/0.6)]"
                              : "bg-[var(--holo-green)]"
                            : "bg-[oklch(1_1_1/0.1)]",
                        )}
                      />
                    );
                  })}
                </span>
                <span
                  className={cn(
                    "font-mono text-[8.5px] tabular-nums",
                    count === 5 ? "text-[var(--holo-green)]" : "text-muted-foreground/60",
                  )}
                >
                  {count}/5
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          Tap a day to audit or fill missed prayers · green segment = logged
        </p>
      </div>
    </div>
  );
}
