import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, History as HistoryIcon, MapPin, RefreshCw } from "lucide-react";
import { useApp, PRAYERS, todayStr } from "@/lib/store";
import { PanelHeader } from "../PanelHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { to12h } from "@/lib/clock";
import { fetchPrayerTimes, requestGeo } from "@/lib/prayerTimes";
import { toast } from "sonner";

// Approximate Hijri conversion (Umm al-Qura algorithm approximation)
function toHijri(date: Date): { day: number; month: string; year: number } {
  const months = [
    "Muharram","Safar","Rabi' al-Awwal","Rabi' al-Thani","Jumada al-Awwal",
    "Jumada al-Thani","Rajab","Sha'ban","Ramadan","Shawwal","Dhu al-Qi'dah","Dhu al-Hijjah",
  ];
  const jd =
    Math.floor((date.getTime() - Date.UTC(1970, 0, 1)) / 86400000) + 2440588;
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
  const isToday = selectedDate === todayStr();
  const isPast = selectedDate < todayStr();
  const locked = isPast && !editPast;

  return (
    <div>
      <PanelHeader
        eyebrow="Tab 02 / Spiritual Focus"
        title="Namaz Discipline"
        subtitle="Five pillars. Zero compromise."
      />

      <div className="glass-panel mb-4 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Hijri Date
          </div>
          <div className="text-2xl font-bold neon-text">
            {hijri.day} {hijri.month} {hijri.year} AH
          </div>
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
          <Button size="icon" variant="ghost" onClick={() => shiftDate(-1)} title="Previous day">
            <ChevronLeft className="size-4" />
          </Button>
          <input
            type="date"
            value={selectedDate}
            max={todayStr()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-background/60 border border-border rounded px-2 py-1 text-xs font-mono"
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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-panel p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-widest">
            Today's Tracking
          </h3>
          <ul className="space-y-3">
            {PRAYERS.map((p) => {
              const done = !!dayPrayers[p.name];
              const t = liveTimes[p.name] ?? p.time;
              return (
                <li
                  key={p.name}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 transition",
                    done
                      ? "border-[var(--neon-cyan)]/40 bg-[oklch(0.85_0.2_200_/_0.08)]"
                      : "border-border bg-background/40",
                  )}
                >
                  <Checkbox
                    checked={done}
                    disabled={locked}
                    onCheckedChange={() => togglePrayer(selectedDate, p.name)}
                  />
                  <div className="flex-1">
                    <div className="font-bold">{p.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {to12h(t)}
                      {liveTimes[p.name] && (
                        <span className="ml-1 text-[9px] uppercase tracking-widest text-[var(--neon-cyan)]">live</span>
                      )}
                    </div>
                  </div>
                  {done && (
                    <span className="text-[10px] uppercase tracking-widest text-[var(--neon-cyan)]">
                      Logged
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="glass-panel p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-widest">
            14-Day History
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => {
              const count = PRAYERS.filter((p) => prayers[d]?.[p.name]).length;
              const isSel = d === selectedDate;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={cn(
                    "aspect-square rounded-md border text-xs flex flex-col items-center justify-center transition",
                    isSel
                      ? "border-[var(--neon-cyan)] bg-[oklch(0.85_0.2_200_/_0.15)]"
                      : "border-border hover:border-muted-foreground",
                  )}
                >
                  <span className="font-bold">{new Date(d).getDate()}</span>
                  <span
                    className={cn(
                      "mt-0.5 font-mono text-[10px]",
                      count === 5 ? "text-[var(--neon-cyan)]" : "text-muted-foreground",
                    )}
                  >
                    {count}/5
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Select any day to edit or fill missed prayers.
          </p>
        </div>
      </div>
    </div>
  );
}