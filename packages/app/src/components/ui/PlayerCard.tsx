"use client";

import { useRef, useState, MouseEvent, memo } from "react";
import { Player } from "@/types";
import { getPlayerImage } from "@/lib/playerImages";

type Rarity = "BRONZE" | "SILVER" | "GOLD" | "ICON";

interface PlayerCardProps {
  player: Player;
  rarity?: Rarity;
  isCaptain?: boolean;
  isBenched?: boolean;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  selected?: boolean;
  tilt?: boolean; // disable 3D tilt in dense grids if needed
}

const RARITY_TOKENS: Record<
  Rarity,
  {
    gradient: string;
    accent: string;
    glow: string;
    label: string;
    text: string;
  }
> = {
  BRONZE: {
    gradient: "from-[#2A1500] via-[#7A4A1F] to-[#1A0E00]",
    accent: "#E0A668",
    glow: "shadow-[0_8px_40px_-12px_rgba(205,127,50,0.6)]",
    label: "Bronze",
    text: "text-[#F2C28E]",
  },
  SILVER: {
    gradient: "from-[#161616] via-[#5A5A5A] to-[#0A0A0A]",
    accent: "#E5E5E5",
    glow: "shadow-[0_8px_40px_-12px_rgba(192,192,192,0.55)]",
    label: "Silver",
    text: "text-[#F2F2F2]",
  },
  GOLD: {
    gradient: "from-[#1A1300] via-[#9C7A1F] to-[#100A00]",
    accent: "#F5D26C",
    glow: "shadow-[0_10px_50px_-12px_rgba(212,175,55,0.75)]",
    label: "Gold",
    text: "text-[#FBE9A5]",
  },
  ICON: {
    gradient: "from-[#001A10] via-[#00B566] to-[#000A05]",
    accent: "#7FE3C0",
    glow: "shadow-[0_12px_60px_-10px_rgba(34, 197, 141,0.8)]",
    label: "Icon",
    text: "text-[#CFF3E5]",
  },
};

const SIZES = {
  sm: {
    w: "w-32",
    h: "h-44",
    name: "text-[11px]",
    rating: "text-2xl",
    statNum: "text-[10px]",
    statLbl: "text-[7px]",
    px: "px-2",
  },
  md: {
    w: "w-44",
    h: "h-60",
    name: "text-sm",
    rating: "text-4xl",
    statNum: "text-[12px]",
    statLbl: "text-[8px]",
    px: "px-2.5",
  },
  lg: {
    w: "w-56",
    h: "h-80",
    name: "text-base",
    rating: "text-5xl",
    statNum: "text-[14px]",
    statLbl: "text-[9px]",
    px: "px-3",
  },
};

export const PlayerCard = memo(PlayerCardInner, (a, b) =>
  a.player.id === b.player.id &&
  a.rarity === b.rarity &&
  a.isCaptain === b.isCaptain &&
  a.isBenched === b.isBenched &&
  a.size === b.size &&
  a.selected === b.selected &&
  a.tilt === b.tilt &&
  a.onClick === b.onClick
);

function PlayerCardInner({
  player,
  rarity = "BRONZE",
  isCaptain = false,
  isBenched = false,
  size = "md",
  onClick,
  selected = false,
  tilt = true,
}: PlayerCardProps) {
  const tokens = RARITY_TOKENS[rarity];
  const dims = SIZES[size];
  const ref = useRef<HTMLButtonElement>(null);
  const [t, setT] = useState({ rx: 0, ry: 0, mx: 50, my: 50, hover: false });
  const [imgFailed, setImgFailed] = useState(false);

  const imgUrl = getPlayerImage(player.id);

  // Synthetic dribbling stat (data has 5 stats; FIFA shows 6)
  const dribbling = Math.round((player.pace + player.passing + player.shooting) / 3);
  const stats: [string, number][] = [
    ["PAC", player.pace],
    ["SHO", player.shooting],
    ["PAS", player.passing],
    ["DRI", dribbling],
    ["DEF", player.defending],
    ["PHY", player.physical],
  ];

  function onMove(e: MouseEvent<HTMLButtonElement>) {
    if (!tilt || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setT({
      rx: (y - 0.5) * -10, // tilt up when cursor is high
      ry: (x - 0.5) * 14, // tilt right when cursor is right
      mx: x * 100,
      my: y * 100,
      hover: true,
    });
  }
  function onLeave() {
    setT({ rx: 0, ry: 0, mx: 50, my: 50, hover: false });
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      aria-label={`${player.name}, ${player.position}, rating ${player.rating}`}
      className={`group relative ${dims.w} ${dims.h}
        ${isBenched ? "opacity-50 grayscale" : ""}
        ${selected ? "ring-2 ring-gaffer-electric ring-offset-2 ring-offset-gaffer-black" : ""}
        active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-gaffer-gold/60`}
      style={{
        transformStyle: "preserve-3d",
        perspective: "1000px",
        transform: `perspective(1000px) rotateX(${t.rx}deg) rotateY(${t.ry}deg) translateZ(0)`,
        transition: t.hover
          ? "transform 80ms cubic-bezier(0.23, 1, 0.32, 1)"
          : "transform 500ms cubic-bezier(0.23, 1, 0.32, 1)",
        willChange: "transform",
      }}
    >
      {/* OUTER METALLIC RIM — dual-layer for FIFA-card depth */}
      <div
        className={`absolute inset-0 rounded-[1.4rem] p-[2.5px] ${tokens.glow}
          transition-shadow duration-300 ease-out-strong
          group-hover:shadow-[0_22px_70px_-10px_var(--accent)]`}
        style={{
          ["--accent" as any]: `${tokens.accent}AA`,
          background: `linear-gradient(155deg, ${tokens.accent}DD 0%, ${tokens.accent}55 25%, rgba(255,255,255,0.15) 50%, ${tokens.accent}33 75%, ${tokens.accent}AA 100%)`,
        }}
      >
        {/* INNER CORE */}
        <div
          className={`relative h-full w-full rounded-[calc(1.4rem-2.5px)] overflow-hidden
            bg-gradient-to-br ${tokens.gradient}
            inner-glow`}
        >
          {/* Vertical metallic stripes — like real foil cards */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent 4px, ${tokens.accent} 4px, ${tokens.accent} 5px)`,
            }}
          />

          {/* Subtle noise grain */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />

          {/* Diagonal cross-band (FIFA-style top-right corner cut) */}
          <div
            className="pointer-events-none absolute -top-6 -right-8 w-28 h-10 opacity-30"
            style={{
              background: `linear-gradient(135deg, transparent, ${tokens.accent}, transparent)`,
              transform: "rotate(45deg)",
            }}
          />

          {/* Spotlight following cursor */}
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out-strong"
            style={{
              opacity: t.hover ? 1 : 0,
              background: `radial-gradient(circle at ${t.mx}% ${t.my}%, ${tokens.accent}40 0%, transparent 45%)`,
            }}
          />

          {/* Diagonal foil sheen (static) */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background: `linear-gradient(135deg, transparent 30%, ${tokens.accent}44 50%, transparent 70%)`,
            }}
          />

          {/* Holographic foil — only for ICON tier (animated) */}
          {rarity === "ICON" && (
            <div
              className="pointer-events-none absolute inset-0 opacity-30 mix-blend-color-dodge"
              style={{
                background:
                  "conic-gradient(from 0deg at 30% 40%, rgba(34, 197, 141,0.4), rgba(212,175,55,0.3), rgba(124,255,196,0.4), rgba(212,175,55,0.2), rgba(34, 197, 141,0.4))",
                animation: "icon-foil 8s linear infinite",
              }}
            />
          )}

          {/* Shimmer sweep — fires on hover */}
          <div
            className="pointer-events-none absolute inset-y-0 -inset-x-1/2 opacity-0 group-hover:opacity-100"
            style={{
              background: `linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.45) 50%, transparent 62%)`,
              animation: t.hover ? "foil-shimmer 1100ms cubic-bezier(0.23,1,0.32,1)" : "none",
            }}
          />

          {/* Corner brackets — FIFA-style metallic edges */}
          <svg
            className="pointer-events-none absolute inset-0 w-full h-full opacity-50"
            viewBox="0 0 100 140"
            preserveAspectRatio="none"
          >
            {/* Top corners */}
            <path d="M 3 12 L 3 3 L 12 3" stroke={tokens.accent} strokeWidth="0.5" fill="none" opacity="0.7" />
            <path d="M 97 12 L 97 3 L 88 3" stroke={tokens.accent} strokeWidth="0.5" fill="none" opacity="0.7" />
            {/* Bottom corners */}
            <path d="M 3 128 L 3 137 L 12 137" stroke={tokens.accent} strokeWidth="0.5" fill="none" opacity="0.7" />
            <path d="M 97 128 L 97 137 L 88 137" stroke={tokens.accent} strokeWidth="0.5" fill="none" opacity="0.7" />
          </svg>

          {/* TOP-LEFT — rating + position (FIFA standard) */}
          <div className="absolute top-2.5 left-3 z-20 flex flex-col items-center">
            <div
              className={`font-display ${dims.rating} leading-none italic`}
              style={{
                color: tokens.accent,
                textShadow: `0 2px 12px ${tokens.accent}77, 0 0 24px ${tokens.accent}33`,
                background: `linear-gradient(180deg, #ffffff 0%, ${tokens.accent} 60%, ${tokens.accent}99 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: `drop-shadow(0 1px 2px ${tokens.accent}66)`,
              }}
            >
              {player.rating}
            </div>
            <div
              className={`font-mono ${dims.statLbl} tracking-[0.22em] mt-0.5 font-bold`}
              style={{ color: tokens.accent, opacity: 0.95 }}
            >
              {player.position}
            </div>
            {/* Thin separator */}
            <div className="w-5 h-px my-1" style={{ background: `linear-gradient(to right, transparent, ${tokens.accent}aa, transparent)` }} />
            {/* Tiny flag chip beneath position */}
            <div
              className={`font-mono ${dims.statLbl} tracking-[0.22em] text-white/70 font-medium`}
            >
              {player.nationCode}
            </div>
          </div>

          {/* Captain crown */}
          {isCaptain && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30">
              <div
                className="rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] font-bold
                  bg-gaffer-electric text-gaffer-black shadow-[0_0_18px_rgba(34, 197, 141,0.7)]"
              >
                C
              </div>
            </div>
          )}
          {isBenched && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30">
              <div className="rounded-full px-2.5 py-1 font-mono text-[8px] tracking-[0.2em] font-bold bg-white/15 text-white/80">
                BENCH
              </div>
            </div>
          )}

          {/* PLAYER FACE — the centerpiece */}
          <div
            className="absolute z-10 flex items-end justify-center"
            style={{
              top: "6%",
              right: "4%",
              left: size === "sm" ? "35%" : "38%",
              bottom: "48%",
            }}
          >
            {/* Double-layer glow halo for depth */}
            <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
              <div
                className="rounded-full blur-3xl opacity-40"
                style={{
                  width: "100%",
                  height: "100%",
                  background: `radial-gradient(circle, ${tokens.accent}, transparent 65%)`,
                }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
              <div
                className="rounded-full blur-xl opacity-50"
                style={{
                  width: "70%",
                  height: "70%",
                  background: `radial-gradient(circle, ${tokens.accent} 0%, transparent 70%)`,
                }}
              />
            </div>

            {/* Stadium pitch lines silhouette (subtle, behind player) */}
            <svg
              className="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-[0.08]"
              width="80%"
              viewBox="0 0 100 40"
              aria-hidden
            >
              <path d="M 50 5 L 10 40 M 50 5 L 90 40 M 25 22 L 75 22" stroke={tokens.accent} strokeWidth="0.4" fill="none" />
              <ellipse cx="50" cy="40" rx="35" ry="4" stroke={tokens.accent} strokeWidth="0.4" fill="none" />
            </svg>

            {imgUrl && !imgFailed ? (
              // All players (modern + legends) — transparent PNG cutouts, contain + bottom-anchored
              <img
                src={imgUrl}
                alt={player.name}
                onError={() => setImgFailed(true)}
                className="relative h-full w-auto max-w-full object-contain object-bottom select-none"
                style={{
                  filter: `drop-shadow(0 6px 16px rgba(0,0,0,0.45)) drop-shadow(0 0 8px ${tokens.accent}33)`,
                  transform: t.hover ? "scale(1.05)" : "scale(1)",
                  transition: "transform 400ms cubic-bezier(0.23, 1, 0.32, 1)",
                }}
                draggable={false}
              />
            ) : (
              // Silhouette fallback
              <div className="relative h-full w-full flex items-end justify-center">
                <svg
                  viewBox="0 0 64 80"
                  className="h-[90%] w-auto opacity-90"
                  style={{
                    filter: `drop-shadow(0 6px 16px rgba(0,0,0,0.45))`,
                  }}
                  aria-hidden
                >
                  <defs>
                    <linearGradient id={`sg-${player.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={tokens.accent} stopOpacity="0.85" />
                      <stop offset="100%" stopColor={tokens.accent} stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                  {/* Head */}
                  <circle cx="32" cy="22" r="13" fill={`url(#sg-${player.id})`} />
                  {/* Shoulders */}
                  <path
                    d="M 8 80 C 8 56 18 42 32 42 C 46 42 56 56 56 80 Z"
                    fill={`url(#sg-${player.id})`}
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Triple-line divider under face — FIFA style */}
          <div className="absolute left-4 right-4" style={{ bottom: "44%" }}>
            <div className="h-px" style={{ background: `linear-gradient(to right, transparent, ${tokens.accent}99, transparent)` }} />
            <div className="h-[2px] mt-0.5 mx-auto w-1/3 rounded-full" style={{ background: `linear-gradient(to right, transparent, ${tokens.accent}, transparent)`, boxShadow: `0 0 8px ${tokens.accent}55` }} />
          </div>

          {/* Player NAME — italic + gradient */}
          <div className={`absolute inset-x-0 ${dims.px} text-center z-10`} style={{ bottom: "36%" }}>
            <div
              className={`font-display italic ${
                size === "sm" ? "text-base" : size === "md" ? "text-xl" : "text-2xl"
              } tracking-[0.08em] leading-none truncate`}
              style={{
                background: `linear-gradient(180deg, #ffffff 0%, #ffffff 60%, ${tokens.accent} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.6)) drop-shadow(0 0 6px ${tokens.accent}33)`,
              }}
            >
              {player.shortName.toUpperCase()}
            </div>
          </div>

          {/* STATS GRID — FIFA UT standard 3x2 with dividers */}
          <div className={`absolute inset-x-2.5 z-10`} style={{ bottom: size === "sm" ? "16%" : "14%" }}>
            <div className="grid grid-cols-3 gap-x-1.5 gap-y-0.5">
              {stats.map(([label, val], i) => (
                <div
                  key={label}
                  className="flex items-baseline justify-center gap-1 relative"
                >
                  {/* Vertical dividers between columns */}
                  {i % 3 !== 0 && (
                    <span
                      className="absolute left-0 top-1/4 bottom-1/4 w-px"
                      style={{ background: `${tokens.accent}33` }}
                    />
                  )}
                  <span
                    className={`font-display italic ${dims.statNum} leading-none font-bold`}
                    style={{ minWidth: "1.5em", textAlign: "right", color: "#ffffff", textShadow: `0 1px 3px rgba(0,0,0,0.6)` }}
                  >
                    {val}
                  </span>
                  <span
                    className={`font-mono ${dims.statLbl} tracking-[0.12em] leading-none uppercase font-bold`}
                    style={{ color: tokens.accent, opacity: 0.75 }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM strip — nation + rarity, with metallic top edge */}
          <div
            className="absolute inset-x-0 bottom-0 px-3 py-2 z-10 flex items-end justify-between gap-2 border-t"
            style={{
              background: `linear-gradient(to top, rgba(0,0,0,0.7), transparent)`,
              borderTopColor: `${tokens.accent}33`,
            }}
          >
            <div className="font-mono text-[8px] tracking-[0.22em] text-white/70 uppercase truncate font-medium">
              {player.nation}
            </div>
            <div
              className="font-mono text-[8px] tracking-[0.25em] uppercase font-bold flex items-center gap-1"
              style={{ color: tokens.accent }}
            >
              <span className="inline-block h-1 w-1 rounded-full" style={{ background: tokens.accent, boxShadow: `0 0 4px ${tokens.accent}` }} />
              {tokens.label}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
