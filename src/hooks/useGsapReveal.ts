import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Staggered reveal for direct children of the returned ref.
 * Re-runs whenever `key` changes (e.g. tab transitions).
 */
export function useGsapReveal<T extends HTMLElement = HTMLDivElement>(
  key?: string | number,
  selector = ":scope > *",
) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll(selector));
    if (!targets.length) return;
    const ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0,
        y: 14,
        duration: 0.45,
        ease: "power2.out",
        stagger: 0.05,
        clearProps: "opacity,transform",
      });
    }, el);
    return () => ctx.revert();
  }, [key, selector]);
  return ref;
}