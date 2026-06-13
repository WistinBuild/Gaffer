"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useGaffer, useManagerRecord, useHasMinted } from "@/lib/useGaffer";
import { Navbar } from "@/components/layout/Navbar";
import { WelcomePack } from "@/components/ui/WelcomePack";
import { Backdrop } from "@/components/ui/Backdrop";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import { consumePitchEntry, playCrowd, playHover, playClick, unlockAudio } from "@/lib/sounds";
import playersData from "@/data/players.json";
import { Player } from "@/types";

const players = playersData as Player[];
const pick = (id: string) => players.find((p) => p.id === id)!;

const FEATURED_LEGEND = pick("pele");
const HERO_PLAYER = pick("mbappe");

function truncate(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function PlayHub() {
  const { address, pubkey, isConnected } = useGaffer();

  // Continue the crowd cheer from portal entry + clear the loading splash
  useEffect(() => {
    if (consumePitchEntry()) playCrowd(4);
    // Defer one frame so the splash overlaps with the first paint of /play
    // (smooth crossfade) rather than disappearing before the page is ready.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("gaffer:splash-clear"));
        }
      });
    });
  }, []);

  const { data: record } = useManagerRecord(pubkey);
  const { data: hasMinted } = useHasMinted(pubkey);

  const winsN = record?.wins ?? 0;
  const lossN = record?.losses ?? 0;
  const tier = winsN >= 8 ? "Elite" : winsN >= 4 ? "Pro" : winsN >= 1 ? "Amateur" : "Rookie";

  return (
    <>
      <Navbar />
      <WelcomePack />

      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8 overflow-hidden">
        <Backdrop src={FOOTBALL_IMAGERY.cosmicStadium} opacity={0.55} blur={2} overlay="hero" blend="normal" scale={1.04} />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-30" />

        <div className="relative mx-auto max-w-7xl">
          {/* ─── HERO STRIP ────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gaffer-electric/15 hairline px-3 py-1 hover-lift">
                <span className="h-1.5 w-1.5 rounded-full bg-gaffer-electric animate-live-dot" />
                <span className="font-mono text-[10px] tracking-[0.22em] text-gaffer-electric uppercase">
                  Inside the gaffer · MD 4
                </span>
              </div>
              <h1 className="mt-5 font-display text-white text-7xl sm:text-9xl leading-[0.85]">
                <LetterWave text="Manager" glow="white" charDelay={26} liftPx={12} />
                <br />
                <span className="text-gaffer-gold">
                  <LetterWave text="HQ." glow="gold" charDelay={28} liftPx={14} />
                </span>
              </h1>
              <p className="mt-4 text-white/55 max-w-xl">
                Your hub — drafted squad on the left, the league waiting on the right,
                legend market always open. Every action is one click away.
              </p>
            </div>

            {/* Manager identity card */}
            <div className="rounded-[1.5rem] p-1.5 bg-gradient-to-br from-gaffer-gold/40 via-white/10 to-transparent">
              <div className="rounded-[calc(1.5rem-0.375rem)] bg-gaffer-surface/80 backdrop-blur-md hairline inner-glow px-5 py-4 min-w-[280px]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">Manager</div>
                    <div className="font-display text-xl text-white mt-1 leading-none">
                      {isConnected ? truncate(address) : "Not connected"}
                    </div>
                  </div>
                  {isConnected && (
                    <div className="rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[0.22em] font-bold bg-gaffer-gold/15 text-gaffer-gold uppercase">
                      {tier}
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-3 gap-3 font-mono text-center">
                  <div>
                    <div className="text-[9px] tracking-[0.22em] text-white/40 uppercase">W</div>
                    <div className="font-display text-2xl text-gaffer-electric tabular-nums leading-none mt-1">{winsN}</div>
                  </div>
                  <div>
                    <div className="text-[9px] tracking-[0.22em] text-white/40 uppercase">L</div>
                    <div className="font-display text-2xl text-gaffer-red tabular-nums leading-none mt-1">{lossN}</div>
                  </div>
                  <div>
                    <div className="text-[9px] tracking-[0.22em] text-white/40 uppercase">Sqd</div>
                    <div className="font-display text-2xl text-gaffer-gold tabular-nums leading-none mt-1">{hasMinted ? "✓" : "—"}</div>
                  </div>
                </div>
                {!isConnected && (
                  <div className="mt-3 pt-3 border-t border-white/5"><ConnectButton /></div>
                )}
              </div>
            </div>
          </div>

          {/* ─── PRIMARY ACTION TILES (Bento) ──────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[220px]">
            <ActionTile
              href="/squad"
              label={hasMinted ? "View squad" : "Build your five"}
              hint={hasMinted ? "Your minted NFTs · stats · forging progress" : "Draft 5 NFTs. One GK + four outfield. Free to mint."}
              step={hasMinted ? "★" : "01"}
              theme="gold"
              span="md:col-span-4 md:row-span-2"
              backdrop={
                <div className="flex items-end gap-3 justify-end pr-2 pb-2">
                  <div className="-rotate-[5deg] opacity-90"><PlayerCard player={pick("van_dijk")} rarity="GOLD" size="sm" tilt={false} /></div>
                  <div className="z-10 rotate-[2deg]"><PlayerCard player={HERO_PLAYER} rarity="ICON" size="md" tilt={false} /></div>
                  <div className="-rotate-[3deg] opacity-90"><PlayerCard player={pick("rodri")} rarity="GOLD" size="sm" tilt={false} /></div>
                </div>
              }
            />
            <ActionTile
              href="/wars"
              label="Find a war"
              hint="1v1 matchday battles · winner takes 95%"
              meta="8 OPEN"
              step="⚔"
              theme="war"
              span="md:col-span-2"
            />
            <ActionTile
              href="/marketplace"
              label="The market"
              hint={`Mint ${FEATURED_LEGEND.shortName}+ · 68 players live`}
              meta="0.45 USDC"
              step="◇"
              theme="market"
              span="md:col-span-2"
              miniFace={FEATURED_LEGEND.id}
            />
            <ActionTile
              href="/predict"
              label="Predict markets"
              hint="Outrights · matches · novelty"
              meta="OPENS MD1"
              step="◊"
              theme="predict"
              span="md:col-span-2"
              locked
            />
            <ActionTile
              href="/leaderboard"
              label="Leaderboard"
              hint="Top managers · profit · streak"
              meta="SEE RANK"
              step="★"
              theme="trophy"
              span="md:col-span-2"
            />
            <ActionTile
              href="/feed"
              label="Live feed"
              hint="Every war · every forging"
              meta={<><span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-live-dot mr-1" />LIVE</>}
              step="▰"
              theme="live"
              span="md:col-span-2"
            />
          </div>

          {/* ─── SECONDARY ROW — Profile + Rules ───────────────────────── */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <ActionTile
              href="/profile"
              label="Your legacy"
              hint="Squad · history · trophies"
              meta="MY GAFFER"
              step="◉"
              theme="legacy"
              span=""
              compact
            />
            <ActionTile
              href="/rules"
              label="How it works"
              hint="Scoring · stages · FAQ"
              meta="READ"
              step="?"
              theme="manual"
              span=""
              compact
            />
          </div>

          {/* ─── BACK TO PORTAL ─────────────────────────────────────── */}
          <div className="mt-12 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] uppercase text-white/40 hover:text-white transition-colors hover-lift"
            >
              ← Back to portal
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

// ─── PIECES ─────────────────────────────────────────────────────────────────

type TileTheme = "gold" | "war" | "market" | "predict" | "trophy" | "live" | "legacy" | "manual";

interface TileThemeConfig {
  glow: string;        // accent color hex
  glow2: string;       // secondary accent
  bgGradient: string;  // base gradient for the tile background
  bgPattern?: string;  // optional SVG/CSS pattern overlay
  ringOutline: string; // shimmer border gradient
  textGlow: "gold" | "electric" | "white" | "red";
  accentClass: string; // text class for accent
}

const THEMES: Record<TileTheme, TileThemeConfig> = {
  gold: {
    glow: "#D4AF37",
    glow2: "#FBE9A5",
    bgGradient: "linear-gradient(135deg, rgba(31,22,4,0.95) 0%, rgba(40,28,8,0.85) 50%, rgba(20,14,2,0.95) 100%)",
    bgPattern: "repeating-linear-gradient(45deg, rgba(212,175,55,0.04) 0px, rgba(212,175,55,0.04) 2px, transparent 2px, transparent 18px)",
    ringOutline: "linear-gradient(135deg, #D4AF37 0%, rgba(212,175,55,0.4) 30%, rgba(255,255,255,0.2) 50%, rgba(212,175,55,0.4) 70%, #D4AF37 100%)",
    textGlow: "gold",
    accentClass: "text-gaffer-gold",
  },
  war: {
    glow: "#E25563",
    glow2: "#FF8888",
    bgGradient: "linear-gradient(135deg, rgba(50,8,8,0.95) 0%, rgba(80,15,15,0.85) 50%, rgba(35,5,5,0.95) 100%)",
    bgPattern: "repeating-linear-gradient(135deg, rgba(226, 85, 99,0.06) 0px, rgba(226, 85, 99,0.06) 2px, transparent 2px, transparent 16px)",
    ringOutline: "linear-gradient(135deg, #E25563 0%, rgba(226, 85, 99,0.4) 30%, rgba(255,255,255,0.2) 50%, rgba(226, 85, 99,0.4) 70%, #E25563 100%)",
    textGlow: "red",
    accentClass: "text-gaffer-red",
  },
  market: {
    glow: "#F5D26C",
    glow2: "#22C58D",
    bgGradient: "linear-gradient(135deg, rgba(28,22,6,0.95) 0%, rgba(8,40,28,0.7) 70%, rgba(15,10,2,0.95) 100%)",
    bgPattern: undefined,
    ringOutline: "linear-gradient(135deg, #F5D26C 0%, rgba(34, 197, 141,0.4) 50%, #F5D26C 100%)",
    textGlow: "gold",
    accentClass: "text-gaffer-gold",
  },
  predict: {
    glow: "#7FE3C0",
    glow2: "#22C58D",
    bgGradient: "linear-gradient(135deg, rgba(2,18,12,0.95) 0%, rgba(5,30,20,0.85) 50%, rgba(2,16,10,0.95) 100%)",
    bgPattern: "radial-gradient(circle at 20% 30%, rgba(34, 197, 141,0.08) 0%, transparent 30%), radial-gradient(circle at 80% 70%, rgba(34, 197, 141,0.06) 0%, transparent 30%)",
    ringOutline: "linear-gradient(135deg, #22C58D 0%, rgba(34, 197, 141,0.3) 50%, #22C58D 100%)",
    textGlow: "electric",
    accentClass: "text-gaffer-electric",
  },
  trophy: {
    glow: "#FBE9A5",
    glow2: "#D4AF37",
    bgGradient: "linear-gradient(180deg, rgba(40,28,8,0.95) 0%, rgba(20,14,2,0.95) 100%)",
    bgPattern: "repeating-linear-gradient(90deg, transparent 0, transparent 12px, rgba(212,175,55,0.05) 12px, rgba(212,175,55,0.05) 13px)",
    ringOutline: "linear-gradient(135deg, #FBE9A5 0%, #D4AF37 50%, #FBE9A5 100%)",
    textGlow: "gold",
    accentClass: "text-gaffer-gold",
  },
  live: {
    glow: "#E25563",
    glow2: "#FFFFFF",
    bgGradient: "linear-gradient(135deg, rgba(50,5,5,0.95) 0%, rgba(20,2,2,0.95) 100%)",
    bgPattern: "repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(255,255,255,0.03) 3px, rgba(255,255,255,0.03) 4px)",
    ringOutline: "linear-gradient(135deg, #E25563 0%, rgba(255,255,255,0.3) 50%, #E25563 100%)",
    textGlow: "red",
    accentClass: "text-gaffer-red",
  },
  legacy: {
    glow: "#7FE3C0",
    glow2: "#D4AF37",
    bgGradient: "linear-gradient(135deg, rgba(2,20,12,0.95) 0%, rgba(28,22,6,0.85) 100%)",
    bgPattern: undefined,
    ringOutline: "linear-gradient(135deg, #22C58D 0%, #D4AF37 100%)",
    textGlow: "electric",
    accentClass: "text-gaffer-electric",
  },
  manual: {
    glow: "#FFFFFF",
    glow2: "#8A9BA8",
    bgGradient: "linear-gradient(135deg, rgba(20,28,40,0.95) 0%, rgba(8,15,25,0.95) 100%)",
    bgPattern: "linear-gradient(0deg, transparent 95%, rgba(255,255,255,0.05) 95%), linear-gradient(90deg, transparent 95%, rgba(255,255,255,0.05) 95%)",
    ringOutline: "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.6) 100%)",
    textGlow: "white",
    accentClass: "text-white",
  },
};

function ActionTile({
  href, label, hint, meta, step, theme, span, backdrop, miniFace, locked, compact,
}: {
  href: string;
  label: string;
  hint: string;
  meta?: React.ReactNode;
  step: string;
  theme: TileTheme;
  span: string;
  backdrop?: React.ReactNode;
  miniFace?: string;
  locked?: boolean;
  compact?: boolean;
}) {
  const t = THEMES[theme];

  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={() => playHover()}
      onClick={() => unlockAudio().then(playClick).catch(() => {})}
      className={`group relative rounded-[2rem] p-[2px] overflow-hidden hover-lift
        transition-all duration-300 ease-out-strong active:scale-[0.985] ${span}`}
      style={{ background: t.ringOutline, backgroundSize: "200% 200%" }}
    >
      {/* Animated rim shimmer on hover */}
      <span
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: t.ringOutline,
          backgroundSize: "200% 200%",
          animation: "tile-rim-shimmer 3s linear infinite",
        }}
      />

      <div
        className={`relative h-full rounded-[calc(2rem-2px)] hairline inner-glow ${compact ? "p-5" : "p-6 sm:p-7"} flex flex-col justify-between gap-3 overflow-hidden`}
        style={{ background: t.bgGradient }}
      >
        {/* Texture pattern overlay */}
        {t.bgPattern && (
          <div className="absolute inset-0 pointer-events-none opacity-100" style={{ background: t.bgPattern }} />
        )}

        {/* Big radial glow blob */}
        <div
          className="absolute -right-16 -top-16 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-500"
          style={{ background: `radial-gradient(circle, ${t.glow}66 0%, transparent 70%)` }}
        />
        <div
          className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `radial-gradient(circle, ${t.glow2}55 0%, transparent 70%)` }}
        />

        {/* Optional backdrop content */}
        {backdrop && (
          <div className="absolute -bottom-2 -right-6 z-0 opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 origin-bottom-right">
            {backdrop}
          </div>
        )}

        {/* Mini face peeking */}
        {miniFace && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 z-0 transition-all duration-500 group-hover:scale-110 group-hover:right-3">
            <img
              src={`/players/${miniFace}.png`}
              alt=""
              className="h-32 w-auto object-contain opacity-55 group-hover:opacity-95 transition-opacity duration-300"
              style={{ filter: `drop-shadow(0 4px 16px ${t.glow}66)` }}
              draggable={false}
            />
          </div>
        )}

        {/* Giant step glyph in background (watermark) */}
        <div
          className="absolute -bottom-8 -left-2 font-display select-none pointer-events-none z-0"
          style={{
            fontSize: compact ? "10rem" : "14rem",
            color: t.glow,
            opacity: 0.06,
            lineHeight: 0.7,
          }}
        >
          {step}
        </div>

        {/* TOP — step + arrow */}
        <div className="relative z-10 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.22em] uppercase font-bold`}
            style={{
              background: `${t.glow}22`,
              color: t.glow,
              border: `1px solid ${t.glow}44`,
              textShadow: `0 0 8px ${t.glow}66`,
            }}>
            {locked && <LockGlyph color={t.glow} />}
            Step {step}
          </span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            className="transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-125"
            style={{ color: t.glow, filter: `drop-shadow(0 0 6px ${t.glow}66)` }}
          >
            <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* CENTER — big label with gradient fill */}
        <div className="relative z-10">
          <div
            className={`font-display ${compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"} leading-[0.92] tracking-wide italic`}
            style={{
              background: `linear-gradient(180deg, #ffffff 0%, #ffffff 55%, ${t.glow} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: `drop-shadow(0 2px 8px ${t.glow}40)`,
            }}
          >
            <HoverWord glow={t.textGlow}>{label.toUpperCase()}</HoverWord>
          </div>
        </div>

        {/* BOTTOM — hint + meta */}
        <div className="relative z-10 flex items-end justify-between gap-3">
          <p className="text-[12px] sm:text-[13px] text-white/70 leading-snug max-w-[58%]">{hint}</p>
          {meta && (
            <span
              className={`inline-flex items-center font-mono text-[11px] tracking-[0.22em] uppercase font-bold rounded-full px-3 py-1`}
              style={{
                background: `${t.glow}1a`,
                color: t.glow,
                border: `1px solid ${t.glow}44`,
                textShadow: `0 0 8px ${t.glow}66`,
              }}
            >
              {meta}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function LockGlyph({ color }: { color: string }) {
  return (
    <svg width="9" height="10" viewBox="0 0 12 14" fill="none" style={{ color }}>
      <path d="M2 6V4a4 4 0 018 0v2M2 6h8v7H2V6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
