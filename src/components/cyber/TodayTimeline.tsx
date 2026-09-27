import { useMemo } from "react";
import { useApp, todayStr, type ScheduleBlock } from "@/lib/store";
import { useNow, to12h } from "@/lib/clock";
import { cn } from "@/lib/utils";
import { HudLabel } from "./HudLabel";
import { Play } from "lucide-react";

/**
 * TodayTimeline — the day as a horizontal strip.
 *
 * This is the answer to "I can't focus on my timetable": the whole day is one
 * glanceable bar. Past is dim, now is the fixed cyan needle, upcoming blocks
 * are solid. No scrolling, no hunting through a week grid to find "what's next".
 */

const BLOCK_TONE: Record<ScheduleBlock["category"], { bar: string; text: string }> = {
  study: { bar: "bg-accent/70", text: "text-accent" },
  work: { bar: "bg-accent/70", text: "text-accent" },
  rest: { bar: "bg-[oklch(0.7_0.13_155/0.6)]", text: "text-[oklch(0.78_0.13_155)]" },
  prayer: { bar: "bg-[oklch(0.75_0.14_85/0.6)]", text: "text-[oklch(0.82_0.14_85)]" },
  other: { bar: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

export function TodayTimeline() {
  const blocks = useApp((s) => s.blocks);
  const completed = useApp((s) => s.completedBlocks);
  const setActiveTab = useApp((s) => s.setActiveTab);
  const now = useNow(15_000);
  const today = todayStr();

  const { items, progressPct, nowLabel, active, next } = useMemo(() => {
    const dow = (now ?? new Date()).getDay();
    const mins = (now ?? new Date()).getHours() * 60 + (now ?? new Date()).getMinutes();
    const doneIds = new Set(completed[today] ?? []);

    const todays = blocks
      .filter(
        (b) => (typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay()) === dow,
      )
      .map((b) => {
        const [sh, sm] = b.start.split(":").map(Number);
        const [eh, em] = b.end.split(":").map(Number);
        return { ...b, sM: sh * 60 + sm, eM: eh * 60 + em, done: doneIds.has(b.id) };
      })
      .sort((a, b) => a.sM - b.sM);

    const active = todays.find((b) => mins >= b.sM && mins < b.eM) ?? null;
    const next = todays.find((b) => b.sM > mins) ?? null;

    return {
      items: todays,
      progressPct: Math.min(100, (mins / 1440) * 100),
      nowLabel: (now ?? new Date()).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      active,
      next,
    };
  }, [blocks, completed, now, today]);

  return (
    <section className="glass-panel flex flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <HudLabel accent="cyan">Today's Timeline</HudLabel>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {active ? (
            <span className="flex items-center gap-1.5 text-[var(--holo-green)]">
              <span className="led-dot size-1.5" style={{ color: "var(--holo-green)" }} />
              now · {active.title}
            </span>
          ) : next ? (
            <span>
              next · <span className="text-foreground/80">{next.title}</span> {to12h(next.start)}
            </span>
          ) : (
            <span>no more blocks today</span>
          )}
          <span suppressHydrationWarning>{nowLabel}</span>
        </div>
      </div>

      {/* the strip */}
      <div className="relative h-9 w-full overflow-hidden rounded-md border border-[oklch(1_1_1/0.07)] bg-[oklch(1_1_1/0.02)]">
        {/* hour ticks */}
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className="absolute inset-y-0 w-px bg-[oklch(1_1_1/0.05)]"
            style={{ left: `${(i / 6) * 100}%` }}
          />
        ))}

        {/* blocks */}
        {items.map((b) => {
          const tone = BLOCK_TONE[b.category] ?? BLOCK_TONE.other;
          const left = (b.sM / 1440) * 100;
          const width = Math.max(0.4, ((b.eM - b.sM) / 1440) * 100);
          return (
            <button
              key={b.id}
              onClick={() => setActiveTab("schedule")}
              title={`${b.title} · ${to12h(b.start)} – ${to12h(b.end)}${b.done ? " · done" : ""}`}
              className={cn(
                "absolute top-1 h-7 min-w-[6px] rounded-[5px] border transition hover:brightness-125",
                tone.bar,
                b.done ? "border-transparent opacity-40" : "border-current/30",
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}

        {/* day progress + now needle */}
        <span
          className="pointer-events-none absolute inset-y-0 left-0 bg-[oklch(1_1_1/0.03)]"
          style={{ width: `${progressPct}%` }}
        />
        <span
          className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
          style={{ left: `${progressPct}%` }}
        >
          <span className="absolute -top-px left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[var(--accent)]" />
        </span>
      </div>

      {/* legend / quick list — only the 3 most relevant blocks */}
      {items.length > 0 && (
        <ul className="mt-3 space-y-1">
          {items
            .filter(
              (b) =>
                b.eM > (now ?? new Date()).getHours() * 60 + (now ?? new Date()).getMinutes() - 60,
            )
            .slice(0, 3)
            .map((b) => {
              const tone = BLOCK_TONE[b.category] ?? BLOCK_TONE.other;
              return (
                <li key={b.id} className="flex items-center gap-2 text-xs">
                  <span className={cn("size-1.5 shrink-0 rounded-full", tone.bar)} />
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {to12h(b.start)}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      b.done ? "text-muted-foreground line-through" : "text-foreground/90",
                    )}
                  >
                    {b.title}
                  </span>
                  {b === active && (
                    <span title="Active now" className="flex">
                      <Play className="size-3 shrink-0 text-[var(--holo-green)]" />
                    </span>
                  )}
                  {b.done && (
                    <span className="font-mono text-[9px] text-muted-foreground">done</span>
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}
