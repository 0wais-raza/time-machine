import { useEffect, useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

/**
 * Animated aurora gradient wash that sits at the top of every page — the
 * signature JARVIS "gradient at the top" effect. Two/three blurred color
 * fields slowly drift and breathe. Purely decorative, GPU-cheap (CSS blur
 * on a few layers, animated via transforms).
 */
export function Aurora({
  className,
  intensity = "normal",
}: {
  className?: string;
  intensity?: "subtle" | "normal" | "strong";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLDivElement>(null);
  const cRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    const c = cRef.current;
    if (!a || !b || !c) return;
    const ctx = gsap.context(() => {
      gsap.to(a, {
        xPercent: 14,
        yPercent: 10,
        scale: 1.25,
        duration: 11,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
      gsap.to(b, {
        xPercent: -12,
        yPercent: -8,
        scale: 1.15,
        duration: 14,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
      gsap.to(c, {
        xPercent: 8,
        yPercent: 12,
        scale: 1.3,
        duration: 17,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
      gsap.fromTo(
        wrapRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.2, ease: "power2.out" },
      );
    }, wrapRef);
    return () => ctx.revert();
  }, []);

  const alpha = intensity === "strong" ? 0.5 : intensity === "subtle" ? 0.28 : 0.4;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 -z-10 h-[340px] overflow-hidden",
        className,
      )}
    >
      {/* base gradient line — the "gradient at the top" signature */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--holo-cyan)]/70 to-transparent" />
      <div
        ref={aRef}
        className="absolute -top-40 left-[-10%] size-[420px] rounded-full"
        style={{
          background: `radial-gradient(circle, oklch(0.85 0.17 200 / ${alpha}) 0%, transparent 62%)`,
          filter: "blur(46px)",
        }}
      />
      <div
        ref={bRef}
        className="absolute -top-32 right-[-8%] size-[400px] rounded-full"
        style={{
          background: `radial-gradient(circle, oklch(0.66 0.27 295 / ${alpha * 0.85}) 0%, transparent 62%)`,
          filter: "blur(46px)",
        }}
      />
      <div
        ref={cRef}
        className="absolute top-[-100px] left-1/2 size-[380px] -translate-x-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, oklch(0.72 0.24 350 / ${alpha * 0.6}) 0%, transparent 62%)`,
          filter: "blur(52px)",
        }}
      />
    </div>
  );
}
