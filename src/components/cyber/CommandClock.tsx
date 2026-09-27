import { useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { useNow } from "@/lib/clock";

/**
 * CommandClock — the dashboard centerpiece.
 *
 * Design intent (deliberate, not decorative):
 *  - Analog + digital together. The analog dial gives instant pre-attentive
 *    "where am I in the day" shape; the digital readout is the precise read.
 *  - A 24h rim shows the day's schedule arcs + a "now" dot, so morning vs
 *    evening is legible without reading anything.
 *  - Hands are drawn imperatively via requestAnimationFrame — the component
 *    re-renders only once per 30s (schedule arcs). Zero jank on weak GPUs.
 *  - Palette is restrained: light ink on near-black, one cyan accent
 *    reserved for "now". No gradients, no glow walls.
 */

const CATEGORY_ACCENT: Record<string, string> = {
  study: "var(--accent)",
  work: "var(--accent)",
  rest: "oklch(0.72 0.13 155)",
  prayer: "oklch(0.75 0.14 85)",
  other: "oklch(0.62 0.02 260)",
};

export function CommandClock({ size = 340 }: { size?: number }) {
  const hourRef = useRef<SVGGElement>(null);
  const minuteRef = useRef<SVGGElement>(null);
  const secondRef = useRef<SVGGElement>(null);
  const nowDotRef = useRef<SVGCircleElement>(null);
  const digitalRef = useRef<HTMLDivElement>(null);
  const secondsRef = useRef<HTMLDivElement>(null);

  const now = useNow(30_000); // re-render cadence for schedule arcs only
  const blocks = useApp((s) => s.blocks);

  const dayDate = now ?? new Date();
  const hour = dayDate.getHours();
  const minute = dayDate.getMinutes();

  // 24h schedule arcs (recomputed once per 30s).
  const dow = dayDate.getDay();
  const nowMins = hour * 60 + minute;
  const arcs = blocks
    .filter(
      (b) => (typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay()) === dow,
    )
    .map((b) => {
      const [sh, sm] = b.start.split(":").map(Number);
      const [eh, em] = b.end.split(":").map(Number);
      const sM = sh * 60 + sm;
      const eM = eh * 60 + em;
      return {
        id: b.id,
        title: b.title,
        category: b.category,
        sDeg: (sM / 1440) * 360,
        eDeg: (Math.max(eM, sM + 1) / 1440) * 360,
        active: nowMins >= sM && nowMins < eM,
      };
    });

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const d = new Date();
      const dayMs =
        d.getMilliseconds() +
        d.getSeconds() * 1000 +
        d.getMinutes() * 60_000 +
        d.getHours() * 3_600_000;

      if (hourRef.current)
        hourRef.current.setAttribute(
          "transform",
          `rotate(${((dayMs % 43_200_000) / 43_200_000) * 360} 100 100)`,
        );
      if (minuteRef.current)
        minuteRef.current.setAttribute(
          "transform",
          `rotate(${((dayMs % 3_600_000) / 3_600_000) * 360} 100 100)`,
        );
      if (secondRef.current) {
        // Gentle tick: ease into each second — calm, mechanical, no sweep blur.
        const eased = (d.getSeconds() + Math.min(1, d.getMilliseconds() / 180)) * 6;
        secondRef.current.setAttribute("transform", `rotate(${eased} 100 100)`);
      }
      if (nowDotRef.current)
        nowDotRef.current.setAttribute(
          "transform",
          `rotate(${(dayMs / 86_400_000) * 360} 100 100)`,
        );
      if (digitalRef.current)
        digitalRef.current.textContent = `${String(d.getHours() % 12 || 12).padStart(2, "0")}:${String(
          d.getMinutes(),
        ).padStart(2, "0")}`;
      if (secondsRef.current)
        secondsRef.current.textContent = `${String(d.getSeconds()).padStart(2, "0")} ${
          d.getHours() >= 12 ? "PM" : "AM"
        }`;

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const C = 100; // viewBox center (200x200)
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const polar = (deg: number, radius: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: r(C + radius * Math.cos(rad)), y: r(C + radius * Math.sin(rad)) };
  };
  const arcPath = (a1: number, a2: number, radius: number) => {
    const s = polar(a1, radius);
    const e = polar(a2, radius);
    const large = a2 - a1 > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
      aria-label="Command clock"
      suppressHydrationWarning
    >
      <svg viewBox="0 0 200 200" width={size} height={size} className="block">
        {/* dial face — quiet depth */}
        <circle cx="100" cy="100" r="97" fill="oklch(0.155 0.004 260)" />
        <circle cx="100" cy="100" r="97" fill="none" stroke="oklch(1 1 1 / 0.07)" strokeWidth="1" />
        <circle cx="100" cy="100" r="88" fill="oklch(0.185 0.006 260)" />

        {/* 24h day rim + "now" dot (rotates once per day) */}
        <circle
          cx="100"
          cy="100"
          r="94"
          fill="none"
          stroke="oklch(1 1 1 / 0.05)"
          strokeWidth="1.5"
        />
        <circle
          ref={nowDotRef}
          cx="100"
          cy="6"
          r="2.6"
          fill="var(--accent)"
          style={{ filter: "drop-shadow(0 0 4px var(--accent))" }}
        />

        {/* schedule arcs — the day visible as shape */}
        {arcs.map((a) => (
          <path
            key={a.id}
            d={arcPath(a.sDeg, a.eDeg, 94)}
            fill="none"
            stroke={CATEGORY_ACCENT[a.category] ?? CATEGORY_ACCENT.other}
            strokeWidth={a.active ? 4 : 2.5}
            opacity={a.active ? 0.95 : 0.45}
            strokeLinecap="butt"
          >
            <title>{a.title}</title>
          </path>
        ))}

        {/* hour ticks + numerals (12h analog convention) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const deg = i * 30;
          const major = i % 3 === 0;
          const p1 = polar(deg, 80);
          const p2 = polar(deg, major ? 71 : 74);
          const lp = polar(deg, 60);
          return (
            <g key={i}>
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={major ? "oklch(0.92 0 0 / 0.9)" : "oklch(0.92 0 0 / 0.35)"}
                strokeWidth={major ? 2.4 : 1.2}
                strokeLinecap="round"
              />
              {major && (
                <text
                  x={lp.x}
                  y={lp.y + 4.5}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="600"
                  fill="oklch(0.93 0 0 / 0.85)"
                  fontFamily="Inter, system-ui, sans-serif"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {i === 0 ? 12 : i}
                </text>
              )}
            </g>
          );
        })}

        {/* hands */}
        <g ref={hourRef}>
          <line
            x1="100"
            y1="112"
            x2="100"
            y2="56"
            stroke="oklch(0.96 0 0)"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
        <g ref={minuteRef}>
          <line
            x1="100"
            y1="116"
            x2="100"
            y2="34"
            stroke="oklch(0.96 0 0)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </g>
        <g ref={secondRef}>
          <line
            x1="100"
            y1="120"
            x2="100"
            y2="30"
            stroke="var(--accent)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="100" cy="30" r="2.4" fill="var(--accent)" />
        </g>
        <circle cx="100" cy="100" r="4.5" fill="oklch(0.96 0 0)" />
        <circle cx="100" cy="100" r="1.8" fill="oklch(0.155 0.004 260)" />
      </svg>

      {/* digital readout — HTML overlay, crisper + cheaper than SVG text */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-[9%]">
        <div
          ref={digitalRef}
          className="font-mono-tech text-2xl font-semibold tracking-[0.08em] tabular-nums"
          style={{ color: "oklch(0.95 0 0)" }}
        >
          --:--
        </div>
        <div
          ref={secondsRef}
          className="mt-0.5 font-mono-tech text-[10px] tracking-[0.3em] tabular-nums"
          style={{ color: "var(--accent)" }}
        >
          -- --
        </div>
      </div>
    </div>
  );
}
