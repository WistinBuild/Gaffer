"use client";

import { ReactNode } from "react";

type Glow = "gold" | "electric" | "white" | "red";

/**
 * Inline-block word that lifts + glows on hover.
 * Use for body emphasis and stat-style callouts.
 */
export function HoverWord({
  children,
  glow = "gold",
  className = "",
}: {
  children: ReactNode;
  glow?: Glow;
  className?: string;
}) {
  return (
    <span
      className={`inline-block transition-[transform,text-shadow,color] duration-300 ease-out-strong
        hover:-translate-y-[3px] cursor-default hover-word hover-word-${glow} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Letter-by-letter wave on hover (stagger via per-char transition-delay).
 * Use for hero headlines.
 */
export function LetterWave({
  text,
  glow = "gold",
  charDelay = 28,
  liftPx = 10,
  className = "",
}: {
  text: string;
  glow?: Glow;
  charDelay?: number;
  liftPx?: number;
  className?: string;
}) {
  const chars = Array.from(text);
  return (
    <span
      className={`letter-wave inline-block whitespace-pre ${className}`}
      style={{
        ["--lift" as any]: `${liftPx}px`,
      }}
      data-glow={glow}
    >
      {chars.map((ch, i) => (
        <span
          key={i}
          className="inline-block transition-[transform,text-shadow] duration-300 ease-out-strong"
          style={{
            transitionDelay: `${i * charDelay}ms`,
          }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}
