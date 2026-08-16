import { useMemo } from "react";
import { useApp, type ScheduleBlock } from "@/lib/store";
import { useNow, to12h } from "@/lib/clock";

const CATEGORY_COLOR: Record<ScheduleBlock["category"], string> = {
  study: "var(--holo-cyan)",
  work: "var(--holo-violet)",
  rest: "var(--holo-green)",
  prayer: "var(--holo-amber)",
  other: "oklch(0.72 0.03 260)",
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function JarvisClock({ size = 360 }: { size?: number }) {
  const now = useNow(1000);
  const blocks = useApp((s) => s.blocks);

  const R = size / 2;
  const sweepR = R - 4; // outermost seconds ring
  const tickOuterR = R - 16;
  const tickInnerR = R - 21;
  const hourLabelR = R - 33;
  const blockR = R - 44;
  const dayRingR = R - 58;
  const handR = R - 66;

  const minute = now ? now.getMinutes() : 0;
  const secondF = now ? now.getSeconds() + now.getMilliseconds() / 1000 : 0;
  const dayPct = now ? (now.getHours() * 60 + minute + secondF / 60) / 1440 : 0;
  const nowMins = now ? now.getHours() * 60 + minute : 0;

  // Today's blocks plotted on the 24h dial.
  const dial = useMemo(() => {
    if (!now) return { todays: [] as (ScheduleBlock & { sM: number; eM: number })[] };
    const dow = now.getDay();
    return {
      todays: blocks
        .filter((b) => {
          const d = typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
          return d === dow;
        })
        .map((b) => {
          const [sh, sm] = b.start.split(":").map(Number);
          const [eh, em] = b.end.split(":").map(Number);
          return { ...b, sM: sh * 60 + sm, eM: eh * 60 + em };
        })
        .sort((a, b) => a.sM - b.sM),
    };
  }, [blocks, now]);

  const todays = dial.todays;
  const active = todays.find((b) => nowMins >= b.sM && nowMins < b.eM);
  const next = todays.find((b) => b.sM >= nowMins && b !== active);

  const sweepC = 2 * Math.PI * sweepR;
  const dayC = 2 * Math.PI * dayRingR;
  const sweepOff = sweepC - (secondF / 60) * sweepC;
  const dayOff = dayC - dayPct * dayC;

  // Countdown to the next block (or end of the active one).
  const countdown = useMemo(() => {
    if (!now) return null;
    const targetMins = active ? active.eM : next ? next.sM : null;
    if (targetMins == null) return null;
    const target = new Date(now);
    target.setHours(0, targetMins, 0, 0);
    const diffSec = Math.max(0, Math.round((target.getTime() - now.getTime()) / 1000));
    const hh = Math.floor(diffSec / 3600);
    const mm = Math.floor((diffSec % 3600) / 60);
    const ss = diffSec % 60;
    return { hh, mm, ss, label: active ? "Block ends" : "Next block" };
  }, [now, active, next]);

  const h24 = now?.getHours() ?? 0;
  const ampm = now ? (h24 >= 12 ? "PM" : "AM") : "--";
  const h12 = now ? (h24 % 12 || 12) : 0;
  const hh = now ? pad(h12) : "--";
  const mm = now ? pad(now.getMinutes()) : "--";
  const ss = now ? pad(now.getSeconds()) : "--";

  const dateLine = now
    ? now
        .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
        .toUpperCase()
    : "";

  const handAngle = (nowMins / 1440) * 360;

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
      suppressHydrationWarning
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <defs>
          <linearGradient id="jarvisSweep" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--holo-cyan)" />
            <stop offset="50%" stopColor="var(--holo-violet)" />
            <stop offset="100%" stopColor="var(--holo-pink)" />
          </linearGradient>
          <filter id="jarvisGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 24h dial ticks */}
        {Array.from({ length: 96 }).map((_, i) => {
          const a = (i / 96) * 360;
          const major = i % 4 === 0; // every hour
          const inner = major ? tickInnerR : tickInnerR - 3;
          const p1 = polar(R, R, inner, a);
          const p2 = polar(R, R, tickOuterR, a);
          return (
            <line
              key={i}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={major ? "var(--holo-cyan)" : "var(--color-border)"}
              strokeWidth={major ? 1.4 : 0.6}
              opacity={major ? 0.8 : 0.45}
            />
          );
        })}
        {/* hour labels */}
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
          const a = (h / 24) * 360;
          const p = polar(R, R, hourLabelR, a);
          return (
            <text
              key={h}
              x={p.x}
              y={p.y + 3}
              textAnchor="middle"
              fontSize={9}
              fill="oklch(0.85 0.17 200 / 0.6)"
              fontFamily="JetBrains Mono, monospace"
            >
              {pad(h)}
            </text>
          );
        })}

        {/* day-elapsed ring */}
        <circle
          cx={R}
          cy={R}
          r={dayRingR}
          fill="none"
          stroke="oklch(1 1 1 / 0.07)"
          strokeWidth="3"
        />
        <circle
          cx={R}
          cy={R}
          r={dayRingR}
          fill="none"
          stroke="oklch(0.66 0.27 295 / 0.65)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={dayC}
          strokeDashoffset={dayOff}
          transform={`rotate(-90 ${R} ${R})`}
          style={{ transition: "stroke-dashoffset 0.9s linear" }}
        />

        {/* schedule blocks as arcs */}
        {todays.map((b) => {
          const startDeg = (b.sM / 1440) * 360;
          const endDeg = (b.eM / 1440) * 360;
          const isActive = active?.id === b.id;
          const isPast = b.eM <= nowMins;
          const color = CATEGORY_COLOR[b.category];
          const d = arcPath(R, R, blockR, startDeg, endDeg);
          return (
            <path
              key={b.id}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={isActive ? 15 : 11}
              strokeLinecap="butt"
              opacity={isPast ? 0.28 : isActive ? 1 : 0.55}
              filter={isActive ? "url(#jarvisGlow)" : undefined}
              style={{ transition: "opacity 0.4s ease, stroke-width 0.4s ease" }}
            >
              <title>{`${b.title} ${to12h(b.start)} – ${to12h(b.end)}`}</title>
            </path>
          );
        })}

        {/* now hand */}
        {now && (
          <g filter="url(#jarvisGlow)">
            <line
              x1={R}
              y1={R}
              x2={polar(R, R, handR, handAngle).x}
              y2={polar(R, R, handR, handAngle).y}
              stroke="var(--holo-cyan)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <circle cx={R} cy={R} r="4" fill="var(--holo-cyan)" />
            <circle
              cx={polar(R, R, handR, handAngle).x}
              cy={polar(R, R, handR, handAngle).y}
              r="5"
              fill="var(--holo-cyan)"
            />
          </g>
        )}

        {/* seconds sweep ring */}
        <circle cx={R} cy={R} r={sweepR} fill="none" stroke="oklch(1 1 1 / 0.06)" strokeWidth="3" />
        <circle
          cx={R}
          cy={R}
          r={sweepR}
          fill="none"
          stroke="url(#jarvisSweep)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={sweepC}
          strokeDashoffset={sweepOff}
          transform={`rotate(-90 ${R} ${R})`}
          filter="url(#jarvisGlow)"
          style={{ transition: "stroke-dashoffset 0.9s linear" }}
        />
      </svg>

      {/* center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div
          className="font-mono-tech text-[44px] font-black leading-none tracking-[0.06em] text-foreground tabular-nums"
          suppressHydrationWarning
        >
          {hh}:{mm}
        </div>
        <div
          className="font-mono-tech mt-1 text-[13px] font-semibold tracking-[0.34em] text-[var(--holo-cyan)] tabular-nums"
          suppressHydrationWarning
        >
          {ss} {ampm}
        </div>
        <div
          className="mt-2 font-mono text-[8.5px] tracking-[0.22em] text-muted-foreground"
          suppressHydrationWarning
        >
          {dateLine}
        </div>

        {/* next block / active block chip */}
        {countdown ? (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-[oklch(0.85_0.17_200/0.3)] bg-[oklch(0.85_0.17_200/0.08)] px-2.5 py-1.5">
            <span className="led-dot size-1.5" style={{ color: "var(--holo-cyan)" }} />
            <span className="max-w-[130px] truncate font-mono text-[8.5px] uppercase tracking-[0.18em] text-muted-foreground">
              {(active ?? next)?.title}
            </span>
            <span
              className="font-mono-tech text-[12px] font-bold tabular-nums text-[var(--holo-cyan)]"
              suppressHydrationWarning
            >
              {pad(countdown.hh)}:{pad(countdown.mm)}:{pad(countdown.ss)}
            </span>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-[oklch(0.8_0.16_155/0.25)] bg-[oklch(0.8_0.16_155/0.07)] px-2.5 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.2em] text-[var(--holo-green)]">
            Open territory — no blocks scheduled
          </div>
        )}
      </div>
    </div>
  );
}
