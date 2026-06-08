"use client";

import { useEffect, useState } from "react";

/**
 * Animated FIFA-style stat dial — circular progress + counting number.
 * Counts up from 0 → value over `duration` ms with cubic ease-out.
 */
export function StatDial({
  value,
  label,
  max = 99,
  size = 56,
  duration = 1400,
  color = "#FFFFFF",
}: {
  value: number;
  label: string;
  max?: number;
  size?: number;
  duration?: number;
  color?: string;
}) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const radius = size / 2 - 4;
  const C = 2 * Math.PI * radius;
  const dash = (n / max) * C;

  return (
    <div className="flex flex-col items-center gap-1.5 cursor-default hover-lift">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="2"
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            style={{
              transition: "stroke-dasharray 60ms linear",
              filter: `drop-shadow(0 0 6px ${color}66)`,
            }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-display tabular-nums"
          style={{ color, fontSize: size * 0.32 }}
        >
          {n}
        </div>
      </div>
      <div className="font-mono text-[9px] tracking-[0.22em] text-white/70 uppercase">
        {label}
      </div>
    </div>
  );
}
