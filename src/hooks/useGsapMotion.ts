import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";

/**
 * Count-up animation for HUD numbers (credits, percentages, streaks).
 * Animates from `from` to `target` whenever `target` changes, and calls
 * `onUpdate` with the current value so callers can render it.
 *
 * Returns a ref to attach the node where text is written.
 */
export function useCountUp(opts: {
  target: number;
  from?: number;
  duration?: number;
  decimals?: number;
  /** Called on every tick with the current animated value. */
  onUpdate: (value: number) => void;
  /** Skip animation (e.g. before mount/hydration completes). */
  disabled?: boolean;
}) {
  const { target, from = 0, duration = 0.9, decimals = 0, onUpdate, disabled } = opts;
  const animRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (disabled) {
      onUpdate(target);
      return;
    }
    animRef.current?.kill();
    const obj = { v: from };
    animRef.current = gsap.to(obj, {
      v: target,
      duration,
      ease: "power2.out",
      overwrite: "auto",
      onUpdate: () => onUpdate(Number(obj.v.toFixed(decimals))),
    });
    return () => {
      animRef.current?.kill();
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, disabled]);

  return { kill: () => animRef.current?.kill() };
}

/** Convenience hook: renders a count-up number directly. */
export function useCountUpValue(
  target: number,
  opts: { duration?: number; decimals?: number; disabled?: boolean } = {},
) {
  const [value, setValue] = useState(0);
  useCountUp({
    target,
    duration: opts.duration,
    decimals: opts.decimals,
    disabled: opts.disabled,
    onUpdate: setValue,
  });
  return value;
}

/**
 * 3D perspective tilt on hover, driven by GSAP. Returns ref + event handlers.
 * Also applies a subtle glow lift. Cheap and silky.
 */
export function useTilt(maxTilt = 8) {
  const ref = useRef<HTMLDivElement | null>(null);
  const state = useRef({ rx: 0, ry: 0 });

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      state.current = { rx: -py * maxTilt, ry: px * maxTilt };
    },
    [maxTilt],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      el.addEventListener("mouseenter", () => {
        gsap.to(el, { duration: 0.4, ease: "power2.out", scale: 1.015, y: -3 });
      });
      el.addEventListener("mousemove", (e: MouseEvent) => onMove(e as unknown as React.MouseEvent));
      el.addEventListener("mousemove", () => {
        gsap.to(el, {
          duration: 0.28,
          ease: "power2.out",
          transform: `perspective(900px) rotateX(${state.current.rx}deg) rotateY(${state.current.ry}deg)`,
        });
      });
      el.addEventListener("mouseleave", () => {
        state.current = { rx: 0, ry: 0 };
        gsap.to(el, {
          duration: 0.5,
          ease: "power3.out",
          transform: "perspective(900px) rotateX(0deg) rotateY(0deg)",
          scale: 1,
          y: 0,
        });
      });
    }, el);
    return () => ctx.revert();
  }, [onMove]);

  return ref;
}

/**
 * Page/tab entrance: animates direct children of the returned ref with a
 * staggered fade + rise when `key` changes. Perfect for tab switches.
 */
export function usePageEntrance<T extends HTMLElement = HTMLDivElement>(
  key?: string | number,
  opts: { stagger?: number; y?: number; duration?: number; selector?: string } = {},
) {
  const ref = useRef<T | null>(null);
  const { stagger = 0.055, y = 22, duration = 0.5, selector = ":scope > *" } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll(selector));
    if (!targets.length) return;
    const ctx = gsap.context(() => {
      // Transform-only (opacity + y + scale) — no blur filter, which is an
      // expensive GPU pass and caused visible lag during tab switches.
      gsap.fromTo(
        targets,
        { opacity: 0, y, scale: 0.985 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration,
          ease: "power3.out",
          stagger,
          overwrite: "auto",
        },
      );
    }, el);
    return () => ctx.revert();
  }, [key, stagger, y, duration, selector]);

  return ref;
}

/**
 * One-shot GSAP "scan" shimmer across an element — used for status banners
 * and hero panels to keep the HUD feeling alive.
 */
export function useScanSweep<T extends HTMLElement = HTMLDivElement>(
  enabled = true,
  interval = 4.2,
) {
  const ref = useRef<T | null>(null);
  const beamRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    const beam = beamRef.current;
    if (!el || !beam) return;
    const ctx = gsap.context(() => {
      const loop = () => {
        gsap.fromTo(
          beam,
          { xPercent: -130, opacity: 0 },
          {
            xPercent: 230,
            opacity: 0.9,
            duration: 1.6,
            ease: "power2.inOut",
            onComplete: () => {
              gsap.set(beam, { opacity: 0 });
              loop();
            },
          },
        );
      };
      loop();
    }, el);
    return () => ctx.revert();
  }, [enabled, interval]);

  return { ref, beamRef };
}
