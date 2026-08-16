import { useNow } from "@/lib/clock";

interface Props {
  size?: number;
}

export function CommandClock({ size = 96 }: Props) {
  const now = useNow(1000);

  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;

  const seconds = now ? now.getSeconds() + now.getMilliseconds() / 1000 : 0;
  const off = c - (seconds / 60) * c;

  const h24 = now?.getHours() ?? 0;
  const ampm = now ? (h24 >= 12 ? "PM" : "AM") : "--";
  const h12 = now ? (h24 % 12 || 12) : 0;
  const hh = now ? String(h12).padStart(2, "0") : "--";
  const mm = now ? String(now.getMinutes()).padStart(2, "0") : "--";
  const ss = now ? String(now.getSeconds()).padStart(2, "0") : "--";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      suppressHydrationWarning
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <defs>
          <linearGradient id="clockRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--neon-cyan)" />
            <stop offset="50%" stopColor="var(--neon-violet)" />
            <stop offset="100%" stopColor="var(--neon-pink)" />
          </linearGradient>
          <filter id="clockGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="2"
        />
        {/* tick marks — round coords to avoid SSR/CSR float drift */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const inner = r - (i % 5 === 0 ? 6 : 3);
          const round = (n: number) => Math.round(n * 1000) / 1000;
          const x1 = round(size / 2 + Math.cos(a) * inner);
          const y1 = round(size / 2 + Math.sin(a) * inner);
          const x2 = round(size / 2 + Math.cos(a) * (r - 1));
          const y2 = round(size / 2 + Math.sin(a) * (r - 1));
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--color-border)"
              strokeWidth={i % 5 === 0 ? 1.2 : 0.6}
              opacity={i % 5 === 0 ? 0.9 : 0.5}
            />
          );
        })}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#clockRing)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          filter="url(#clockGlow)"
          style={{ transition: "stroke-dashoffset 0.9s linear" }}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        <div
          className="font-mono-tech text-base font-bold tracking-[0.18em] text-foreground tabular-nums"
          suppressHydrationWarning
        >
          {hh}:{mm}
        </div>
        <div
          className="font-mono-tech mt-0.5 text-[9px] tracking-[0.32em] text-[var(--neon-cyan)] tabular-nums"
          suppressHydrationWarning
        >
          {ss} {ampm}
        </div>
      </div>
    </div>
  );
}