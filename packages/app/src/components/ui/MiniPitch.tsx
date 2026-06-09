"use client";

import { useEffect, useMemo, useState } from "react";

interface YourPlayer {
  id: string;
  position: "GK" | "DEF" | "MID" | "FWD" | "FLEX";
  isCaptain?: boolean;
}

interface Dot {
  id: string;
  team: "you" | "ai" | "opp";
  position: "GK" | "DEF" | "MID" | "FWD";
  isCaptain?: boolean;
  // Home zone (normalized 0..1 within pitch)
  hx: number;
  hy: number;
}

// Home zone centers — your side on the LEFT, opponent on the RIGHT
const HOME_X: Record<string, number> = { GK: 0.06, DEF: 0.22, MID: 0.4, FWD: 0.62 };

export type Celebration =
  | null
  | { type: "goal_you"; label?: string }
  | { type: "goal_opp"; label?: string }
  | { type: "penalty_opp"; label?: string }
  | { type: "save"; label?: string };

interface MiniPitchProps {
  yourSquad: YourPlayer[];
  /** Player ID currently in a decision — gets a pulsing highlight */
  activePlayerId?: string | null;
  /** Show small score badge top-center */
  yourScore?: number;
  oppScore?: number;
  /** Animation tempo (between decisions). Higher = slower drift. */
  tickMs?: number;
  /** Triggers dramatic celebration sequence — ball flies to goal + overlay */
  celebration?: Celebration;
  /** Freeze player + ball motion (used while a decision panel is open) */
  paused?: boolean;
}

/**
 * Top-down 2D mini pitch with 5 your + 6 AI + 11 opposition dots + ball.
 * Pure CSS transitions — no Phaser, no canvas, zero perf cost.
 */
export function MiniPitch({
  yourSquad,
  activePlayerId,
  yourScore,
  oppScore,
  tickMs = 1400,
  celebration = null,
  paused = false,
}: MiniPitchProps) {
  // ─── Build the 22 dots + ball with stable home positions ───────────────────
  const dots = useMemo<Dot[]>(() => {
    const out: Dot[] = [];

    // YOUR 5 — actual position from squad
    const byPos = (pos: string) => yourSquad.filter((p) => p.position === pos);
    yourSquad.forEach((p) => {
      const same = byPos(p.position);
      const idx = same.indexOf(p);
      const total = same.length;
      const hx = HOME_X[p.position] ?? 0.4;
      const hy = total === 1 ? 0.5 : 0.18 + ((idx + 0.5) / total) * 0.64;
      out.push({ id: p.id, team: "you", position: p.position as any, isCaptain: p.isCaptain, hx, hy });
    });

    // 6 AI TEAMMATES — fill out a 4-3-3-ish shape
    const aiRoles: ("GK" | "DEF" | "MID" | "FWD")[] = ["DEF", "DEF", "DEF", "MID", "MID", "FWD"];
    const aiByPos = (pos: string) => aiRoles.filter((r) => r === pos);
    aiRoles.forEach((pos, i) => {
      const same = aiByPos(pos);
      const idx = aiRoles.slice(0, i).filter((r) => r === pos).length;
      const total = same.length;
      const hx = (HOME_X[pos] ?? 0.4) + 0.02;
      const hy = 0.14 + ((idx + 0.5) / total) * 0.72;
      out.push({ id: `ai-${i}`, team: "ai", position: pos, hx, hy });
    });

    // 11 OPPOSITION — mirrored 4-3-3
    const oppRoles: ("GK" | "DEF" | "MID" | "FWD")[] = [
      "GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD", "FWD",
    ];
    const oppByPos = (pos: string) => oppRoles.filter((r) => r === pos);
    oppRoles.forEach((pos, i) => {
      const same = oppByPos(pos);
      const idx = oppRoles.slice(0, i).filter((r) => r === pos).length;
      const total = same.length;
      const hx = 1 - (HOME_X[pos] ?? 0.4);
      const hy = total === 1 ? 0.5 : 0.14 + ((idx + 0.5) / total) * 0.72;
      out.push({ id: `opp-${i}`, team: "opp", position: pos, hx, hy });
    });

    return out;
  }, [yourSquad]);

  // ─── Live positions ────────────────────────────────────────────────────────
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(dots.map((d) => [d.id, { x: d.hx, y: d.hy }])),
  );
  const [ball, setBall] = useState({ x: 0.5, y: 0.5 });

  // Reset positions when squad changes
  useEffect(() => {
    setPositions(Object.fromEntries(dots.map((d) => [d.id, { x: d.hx, y: d.hy }])));
  }, [dots]);

  // ─── Movement tick — wander around home zone ──────────────────────────────
  // Paused while a decision panel is open — the pitch freezes so the user can
  // focus on the choice. Resumes on decision close.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setPositions((prev) => {
        const next: Record<string, { x: number; y: number }> = { ...prev };
        for (const d of dots) {
          // GK barely moves
          const radius = d.position === "GK" ? 0.015 : d.team === "you" || d.team === "ai" ? 0.06 : 0.05;
          const x = d.hx + (Math.random() - 0.5) * 2 * radius;
          const y = d.hy + (Math.random() - 0.5) * 2 * radius * 1.5;
          next[d.id] = {
            x: clamp(x, 0.03, 0.97),
            y: clamp(y, 0.06, 0.94),
          };
        }
        return next;
      });

      // Ball drift — but more dramatic, simulating play
      setBall((p) => ({
        x: clamp(p.x + (Math.random() - 0.5) * 0.25, 0.08, 0.92),
        y: clamp(p.y + (Math.random() - 0.5) * 0.25, 0.12, 0.88),
      }));
    }, tickMs);
    return () => clearInterval(t);
  }, [dots, tickMs, paused]);

  // ─── When a decision fires, snap ball to that player ───────────────────────
  useEffect(() => {
    if (!activePlayerId) return;
    const pos = positions[activePlayerId];
    if (pos) setBall({ x: pos.x, y: pos.y });
  }, [activePlayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Celebration — animate ball to the appropriate goal ──────────────────
  useEffect(() => {
    if (!celebration) return;
    if (celebration.type === "goal_you") {
      // ball flies to OPPONENT goal (right side)
      setBall({ x: 0.985, y: 0.5 });
    } else if (celebration.type === "goal_opp" || celebration.type === "penalty_opp") {
      // ball flies to YOUR goal (left side)
      setBall({ x: 0.015, y: 0.5 });
    } else if (celebration.type === "save") {
      // bounces back to midfield
      setBall({ x: 0.3, y: 0.5 });
    }
  }, [celebration]);

  return (
    <div className="relative w-full aspect-[2.2/1] rounded-2xl overflow-hidden bg-gradient-to-br from-gaffer-pitch/60 via-[#0e2218] to-[#08160f] hairline-strong ring-1 ring-white/5">
      {/* Pitch markings */}
      <svg
        viewBox="0 0 220 100"
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="pitchStripes" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="rgba(255,255,255,0.015)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.045)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.015)" />
          </linearGradient>
        </defs>
        {/* Striped grass effect */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <rect
            key={i}
            x={i * 22}
            y="0"
            width="22"
            height="100"
            fill={i % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent"}
          />
        ))}
        {/* Outer border */}
        <rect x="3" y="3" width="214" height="94" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.4" />
        {/* Center line */}
        <line x1="110" y1="3" x2="110" y2="97" stroke="rgba(255,255,255,0.18)" strokeWidth="0.4" />
        {/* Center circle */}
        <circle cx="110" cy="50" r="11" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.4" />
        <circle cx="110" cy="50" r="0.8" fill="rgba(255,255,255,0.4)" />
        {/* Left penalty box (your side) */}
        <rect x="3"  y="25" width="24" height="50" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.4" />
        <rect x="3"  y="37" width="8"  height="26" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.4" />
        {/* Right penalty box */}
        <rect x="193" y="25" width="24" height="50" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.4" />
        <rect x="209" y="37" width="8"  height="26" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.4" />
        {/* Corner arcs */}
        {[[3, 3], [217, 3], [3, 97], [217, 97]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.3" />
        ))}
      </svg>

      {/* Stadium glow overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.06), transparent 70%)",
        }}
      />

      {/* Player dots */}
      {dots.map((d) => {
        const pos = positions[d.id] ?? { x: d.hx, y: d.hy };
        const isActive = activePlayerId === d.id;
        const color =
          d.team === "you"
            ? d.isCaptain
              ? "#22C58D"
              : "#F5D26C"
            : d.team === "ai"
              ? "#A9885A"
              : "#FF5252";
        const size = d.team === "you" ? 12 : d.team === "ai" ? 8 : 9;
        return (
          <div
            key={d.id}
            className="absolute rounded-full transition-all ease-out-strong"
            style={{
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              width: size,
              height: size,
              transitionDuration: `${tickMs}ms`,
              transform: "translate(-50%, -50%)",
              background: color,
              boxShadow: isActive
                ? `0 0 0 2px white, 0 0 14px 3px ${color}, 0 0 28px 6px ${color}88`
                : d.team === "you"
                  ? `0 0 8px ${color}cc, 0 1px 2px rgba(0,0,0,0.4)`
                  : `0 0 4px ${color}80, 0 1px 2px rgba(0,0,0,0.4)`,
              zIndex: isActive ? 20 : d.team === "you" ? 10 : d.team === "ai" ? 5 : 3,
              animation: isActive ? "pitch-pulse 1.2s ease-in-out infinite" : undefined,
            }}
          />
        );
      })}

      {/* Ball — flies faster during celebrations */}
      <div
        className="absolute rounded-full bg-white"
        style={{
          left: `${ball.x * 100}%`,
          top: `${ball.y * 100}%`,
          width: celebration ? 7 : 5,
          height: celebration ? 7 : 5,
          transitionProperty: "left, top, width, height",
          transitionDuration: celebration ? "700ms" : "600ms",
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)", // overshoot for impact
          transform: "translate(-50%, -50%)",
          boxShadow: celebration ? "0 0 8px white, 0 0 24px rgba(255,255,255,0.9)" : "0 0 4px white, 0 0 10px rgba(255,255,255,0.6)",
          zIndex: 25,
        }}
      />

      {/* Goals (subtle posts) */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[6px] h-[18%] bg-white/10 rounded-r" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[6px] h-[18%] bg-white/10 rounded-l" />

      {/* Side labels */}
      <div className="absolute top-2 left-3 font-mono text-[9px] tracking-[0.22em] text-gaffer-gold/60 uppercase">
        Your half
      </div>
      <div className="absolute top-2 right-3 font-mono text-[9px] tracking-[0.22em] text-gaffer-red/60 uppercase">
        Their half
      </div>

      {/* Score badge */}
      {(yourScore !== undefined && oppScore !== undefined) && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 backdrop-blur px-3 py-1 font-mono text-[10px] tracking-[0.15em] uppercase ring-1 ring-white/15">
          <span className="text-gaffer-electric tabular-nums">{String(yourScore).padStart(2, "0")}</span>
          <span className="text-white/30">—</span>
          <span className="text-white/80 tabular-nums">{String(oppScore).padStart(2, "0")}</span>
        </div>
      )}

      {/* Legend (bottom) */}
      <div className="absolute bottom-2 left-3 flex items-center gap-4 font-mono text-[9px] tracking-[0.18em] uppercase text-white/45">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gaffer-electric" style={{ boxShadow: "0 0 6px #22C58D" }} />
          Captain
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gaffer-gold" style={{ boxShadow: "0 0 6px #D4AF37" }} />
          Your deck
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#A9885A]" />
          AI mates
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5252]" />
          Opponent
        </span>
      </div>

      {/* ─── CELEBRATION OVERLAY ─────────────────────────────────────── */}
      {celebration && <CelebrationOverlay celebration={celebration} />}

      <style jsx>{`
        @keyframes pitch-pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.55);
          }
        }
      `}</style>
    </div>
  );
}

// ─── Celebration overlay — dramatic full-pitch flash + text ────────────────
function CelebrationOverlay({ celebration }: { celebration: NonNullable<Celebration> }) {
  const isGood = celebration.type === "goal_you" || celebration.type === "save";
  const isPenalty = celebration.type === "penalty_opp";

  const text = {
    goal_you:    "GOAL!",
    goal_opp:    "GOAL CONCEDED",
    penalty_opp: "PENALTY!",
    save:        "SAVED",
  }[celebration.type];

  const color = isGood ? "#22C58D" : isPenalty ? "#E25563" : "#FF6B6B";
  const subtext = celebration.label ?? "";

  return (
    <>
      {/* Vignette flash */}
      <div
        className="absolute inset-0 pointer-events-none z-30"
        style={{
          background: `radial-gradient(ellipse at center, transparent 30%, ${color}33 80%, ${color}66 100%)`,
          animation: "celeb-flash 1400ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
        }}
      />
      {/* Confetti particles for your goal */}
      {celebration.type === "goal_you" && (
        <>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="absolute rounded-sm z-40 pointer-events-none"
              style={{
                left: `${50 + (i - 9) * 4}%`,
                top: "50%",
                width: 4 + (i % 3),
                height: 4 + (i % 3),
                background: i % 3 === 0 ? "#22C58D" : i % 3 === 1 ? "#F5D26C" : "#FFFFFF",
                animation: `confetti-${i % 4} 1400ms cubic-bezier(0.23, 1, 0.32, 1) forwards`,
                animationDelay: `${i * 25}ms`,
              }}
            />
          ))}
        </>
      )}

      {/* Big text — centered, scaled-in */}
      <div
        className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none"
        style={{
          animation: "celeb-text 1400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <div
          className="font-display tracking-[0.15em] leading-none"
          style={{
            color,
            fontSize: "clamp(2.5rem, 7vw, 5rem)",
            textShadow: `0 0 30px ${color}, 0 0 60px ${color}88`,
          }}
        >
          {text}
        </div>
        {subtext && (
          <div className="font-mono text-[11px] sm:text-xs tracking-[0.22em] text-white/90 uppercase mt-2 max-w-md text-center px-4">
            {subtext}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes celeb-flash {
          0%   { opacity: 0; }
          15%  { opacity: 1; }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes celeb-text {
          0%   { opacity: 0; transform: scale(0.4) rotate(-3deg); }
          25%  { opacity: 1; transform: scale(1.1) rotate(1deg); }
          50%  { opacity: 1; transform: scale(1) rotate(0deg); }
          85%  { opacity: 1; transform: scale(1) rotate(0deg); }
          100% { opacity: 0; transform: scale(1.05) translateY(-8px); }
        }
        @keyframes confetti-0 {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(-60px, -120px) rotate(360deg); opacity: 0; }
        }
        @keyframes confetti-1 {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(50px, -140px) rotate(-380deg); opacity: 0; }
        }
        @keyframes confetti-2 {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(-80px, 80px) rotate(280deg); opacity: 0; }
        }
        @keyframes confetti-3 {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(70px, 100px) rotate(-300deg); opacity: 0; }
        }
      `}</style>
    </>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
