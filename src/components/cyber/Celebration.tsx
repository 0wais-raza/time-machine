import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Coins, Sparkles } from "lucide-react";

export interface CelebrationPayload {
  title: string;
  message: string;
  credits: number;
}

const COLORS = [
  "oklch(0.85 0.17 200)", // cyan
  "oklch(0.66 0.27 295)", // violet
  "oklch(0.72 0.24 350)", // pink
  "oklch(0.82 0.16 80)", // amber
  "oklch(0.8 0.16 155)", // green
];

/**
 * Full-screen JARVIS celebration — a GSAP particle burst radiating from the
 * center plus a glowing banner. Triggered with:
 *
 *   window.dispatchEvent(new CustomEvent("cv:celebrate", { detail }))
 */
export function Celebration() {
  const [payload, setPayload] = useState<CelebrationPayload | null>(null);
  const burstRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const tick = useRef(0);

  useEffect(() => {
    const onCelebrate = (e: Event) => {
      const detail = (e as CustomEvent<CelebrationPayload>).detail;
      if (!detail) return;
      tick.current += 1;
      setPayload(detail);
    };
    window.addEventListener("cv:celebrate", onCelebrate);
    return () => window.removeEventListener("cv:celebrate", onCelebrate);
  }, []);

  // Run the burst when a new payload lands.
  useEffect(() => {
    if (!payload) return;
    const burst = burstRef.current;
    const banner = bannerRef.current;
    if (!burst || !banner) return;

    const ctx = gsap.context(() => {
      // 28 particles — small glowing squares that fly out radially.
      const parts = Array.from(burst.children) as HTMLElement[];
      parts.forEach((p, i) => {
        const angle = (i / parts.length) * Math.PI * 2;
        const dist = 150 + Math.random() * 190;
        const color = COLORS[i % COLORS.length];
        gsap.set(p, {
          x: 0,
          y: 0,
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}`,
        });
        gsap.to(p, {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          opacity: 0,
          scale: Math.random() * 1.6 + 0.4,
          duration: 1.1 + Math.random() * 0.6,
          ease: "power2.out",
          delay: 0.05,
        });
      });

      // Banner: rise in with a glow, then fade out.
      const tl = gsap.timeline();
      tl.fromTo(
        banner,
        { opacity: 0, y: 40, scale: 0.85, filter: "blur(6px)" },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.55,
          ease: "back.out(1.8)",
          clearProps: "filter",
        },
      )
        .to(banner, {
          opacity: 0,
          y: -26,
          scale: 0.96,
          duration: 0.45,
          ease: "power2.in",
          delay: 2.1,
        })
        .call(() => setPayload(null));
    }, burst);

    return () => ctx.revert();
  }, [payload]);

  if (!payload) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center">
      {/* particle burst */}
      <div ref={burstRef} className="absolute left-1/2 top-1/2">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="absolute left-0 top-0 size-2 rounded-[2px]"
            style={{ transform: "translate(-50%, -50%)" }}
          />
        ))}
      </div>

      {/* banner */}
      <div
        ref={bannerRef}
        className="corner-brackets glass-panel relative px-10 py-7 text-center"
        style={{ opacity: 0 }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--holo-cyan)]/80 to-transparent" />
        <div className="flex items-center justify-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--holo-cyan)]">
          <Sparkles className="size-3.5" />
          Namaz Cycle Complete
        </div>
        <div className="mt-2 text-3xl font-black tracking-tight text-foreground">
          {payload.title}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{payload.message}</div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[oklch(0.82_0.16_80/0.5)] bg-[oklch(0.82_0.16_80/0.1)] px-4 py-1.5">
          <Coins className="size-4 text-[var(--holo-amber)]" />
          <span className="font-mono-tech text-xl font-black text-[var(--holo-amber)] tabular-nums">
            +{payload.credits} CR
          </span>
        </div>
      </div>
    </div>
  );
}
