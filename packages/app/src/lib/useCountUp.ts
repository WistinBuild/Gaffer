"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Smoothly animates a number from previous value to current value over `duration` ms.
 * Use for stat displays where the number changes from user interaction.
 */
export function useCountUp(target: number, duration = 500): number {
  const [n, setN] = useState(target);
  const prevTarget = useRef(target);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (target === prevTarget.current) return;
    const from = prevTarget.current;
    const to = target;
    const start = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else prevTarget.current = to;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return n;
}
