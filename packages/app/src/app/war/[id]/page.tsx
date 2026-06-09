"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { formatEther, zeroAddress, type Address } from "viem";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import { CONTRACT_ADDRESSES, SQUAD_WARS_ABI, GAFFER_NFT_ABI } from "@/lib/contracts";
import playersData from "@/data/players.json";
import { Player } from "@/types";

const players = playersData as Player[];
const pick = (id: string) => players.find((p) => p.id === id) ?? players[0];

type Rarity = "BRONZE" | "SILVER" | "GOLD" | "ICON";
const RARITY_NAMES: Rarity[] = ["BRONZE", "SILVER", "GOLD", "ICON"];

interface ChainWar {
  id: bigint;
  challenger: Address;
  opponent: Address;
  stake: bigint;
  matchday: bigint;
  captainSlot: number;
  benchedSlot: number;
  opponentCaptainSlot: number;
  opponentBenchedSlot: number;
  challengerScore: bigint;
  opponentScore: bigint;
  status: number;
  winner: Address;
  decisionLocked: boolean;
}

interface ChainCard {
  playerId: string;
  position: number;
  rarity: number;
  tournamentPts: number;
  goals: number;
  assists: number;
  cleanSheets: number;
}

type SquadEntry = {
  id: string;
  rarity: Rarity;
  pts: number;
  isCaptain: boolean;
  isBench: boolean;
  perf: string;
};

const STAGE_BY_MD = (md: number) =>
  md <= 3 ? { stage: "GROUP", mult: 1.0 } :
  md <= 5 ? { stage: "R16",   mult: 1.2 } :
  md === 6 ? { stage: "QF",    mult: 1.5 } :
  md === 7 ? { stage: "SF",    mult: 2.0 } :
            { stage: "FINAL", mult: 3.0 };

export default function WarDetailPage() {
  const params = useParams();
  const warIdStr = (params?.id as string) ?? "0";
  const warIdBig = BigInt(warIdStr);
  const { address } = useAccount();
  const me = address?.toLowerCase();

  // Read this war from chain
  const { data: warData, isLoading: warLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.squadWars,
    abi: SQUAD_WARS_ABI,
    functionName: "getWar",
    args: [warIdBig],
    query: { enabled: warIdBig > BigInt(0) },
  });
  const w = warData as unknown as ChainWar | undefined;

  // Read both squads' token IDs
  const { data: chalSquadIds } = useReadContract({
    address: CONTRACT_ADDRESSES.gafferNFT,
    abi: GAFFER_NFT_ABI,
    functionName: "getSquad",
    args: w && w.challenger !== zeroAddress ? [w.challenger] : undefined,
    query: { enabled: !!w && w.challenger !== zeroAddress },
  });
  const { data: oppSquadIds } = useReadContract({
    address: CONTRACT_ADDRESSES.gafferNFT,
    abi: GAFFER_NFT_ABI,
    functionName: "getSquad",
    args: w && w.opponent !== zeroAddress ? [w.opponent] : undefined,
    query: { enabled: !!w && w.opponent !== zeroAddress },
  });

  // Batch-fetch all 10 cards (5 + 5) via multicall
  const allTokenIds = useMemo(() => {
    const ids: bigint[] = [];
    if (chalSquadIds) ids.push(...(chalSquadIds as readonly bigint[]));
    if (oppSquadIds) ids.push(...(oppSquadIds as readonly bigint[]));
    return ids;
  }, [chalSquadIds, oppSquadIds]);
  const cardContracts = useMemo(
    () =>
      allTokenIds.map((tokenId) => ({
        address: CONTRACT_ADDRESSES.gafferNFT,
        abi: GAFFER_NFT_ABI,
        functionName: "getCard" as const,
        args: [tokenId] as const,
      })),
    [allTokenIds],
  );
  const { data: cardResults } = useReadContracts({
    contracts: cardContracts,
    query: { enabled: cardContracts.length > 0 },
  });

  // Build challenger + opponent squad entries with captain/bench flags + perf
  const { challengerSquad, opponentSquad } = useMemo(() => {
    if (!w || !cardResults) return { challengerSquad: [] as SquadEntry[], opponentSquad: [] as SquadEntry[] };
    const cards = cardResults.map((r) =>
      r.status === "success" ? (r.result as unknown as ChainCard) : null,
    );
    const buildSide = (offset: number, capSlot: number, benchSlot: number): SquadEntry[] =>
      Array.from({ length: 5 }, (_, idx) => {
        const c = cards[offset + idx];
        if (!c) return { id: "alisson", rarity: "BRONZE", pts: 0, isCaptain: false, isBench: idx === benchSlot, perf: "—" } as SquadEntry;
        const isCaptain = idx === capSlot;
        const isBench = idx === benchSlot;
        return {
          id: c.playerId,
          rarity: RARITY_NAMES[c.rarity] ?? "BRONZE",
          pts: Number(c.tournamentPts),
          isCaptain,
          isBench,
          perf: isBench ? "BENCHED"
              : `${c.goals}G · ${c.assists}A · ${c.cleanSheets}CS${isCaptain ? " · 2× capt" : ""}`,
        };
      });
    return {
      challengerSquad: buildSide(0, w.captainSlot, w.benchedSlot),
      opponentSquad:   buildSide(5, w.opponentCaptainSlot, w.opponentBenchedSlot),
    };
  }, [w, cardResults]);

  // Derived values
  const exists = !!w && w.challenger !== zeroAddress;
  const matchday = w ? Number(w.matchday) : 0;
  const { stage, mult } = STAGE_BY_MD(matchday);
  const statusLabel = ["OPEN", "ACTIVE", "RESOLVED", "CANCELLED"][w?.status ?? 0];
  const potETH = w ? Number(formatEther(w.stake)) * 2 : 0;
  const feeETH = potETH * 0.05;
  const payoutETH = potETH - feeETH;
  const chalScore = w ? Number(w.challengerScore) : 0;
  const oppScore = w ? Number(w.opponentScore) : 0;
  const youWon = w ? w.winner.toLowerCase() === me : false;
  const youAreChallenger = w ? w.challenger.toLowerCase() === me : false;
  const youArePart = youAreChallenger || (w?.opponent.toLowerCase() === me);

  // ───────────────────────── Render guards ─────────────────────────
  if (warLoading) {
    return (
      <>
        <Navbar />
        <main className="relative min-h-[100dvh] pt-32 px-4 sm:px-8 flex items-center justify-center">
          <div className="font-display text-white/40 text-3xl">Loading war #{warIdStr}…</div>
        </main>
      </>
    );
  }
  if (!exists) {
    return (
      <>
        <Navbar />
        <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
          <Backdrop src={FOOTBALL_IMAGERY.stadiumNight} opacity={0.3} blur={3} overlay="hero" blend="luminosity" />
          <div className="relative mx-auto max-w-3xl">
            <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
              <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-12 text-center">
                <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">War #{warIdStr}</div>
                <h1 className="mt-4 font-display text-white text-5xl">This war doesn't exist.</h1>
                <p className="mt-3 text-white/55">Either the ID is wrong or it hasn't been created on-chain yet.</p>
                <Link href="/wars" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gaffer-gold pl-5 pr-2 py-2 text-gaffer-black transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light">
                  <span className="font-display text-base tracking-wider">BROWSE WARS</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gaffer-black/15">→</span>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        <Backdrop src={FOOTBALL_IMAGERY.stadiumNight} opacity={0.32} blur={3} overlay="hero" blend="luminosity" scale={1.05} />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-30" />

        <div className="relative mx-auto max-w-7xl">
          {/* TOP BAR */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
            <Link href="/wars" className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] uppercase text-white/60 hover:text-white transition-colors hover-lift">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              All wars
            </Link>
            <div className="flex items-center gap-3">
              <StatusBadge status={statusLabel} />
              <div className="font-mono text-[11px] tracking-[0.22em] text-white/40 uppercase">
                War #{warIdStr} · {stage} · MD{matchday}
              </div>
            </div>
          </div>

          {/* HEADLINE */}
          <div className="text-center mb-12">
            <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-gold/80 uppercase mb-3">
              {stage} · matchday {matchday} · {mult}× multiplier
            </div>
            <h1 className="font-display text-white text-6xl sm:text-9xl leading-[0.85] tracking-wide">
              <span className={youWon && youAreChallenger ? "text-gaffer-electric" : "text-white/80"}>
                <LetterWave text={String(chalScore).padStart(2,"0")} glow="electric" charDelay={40} liftPx={16} />
              </span>
              <span className="text-white/30 mx-4 sm:mx-8">—</span>
              <span className={youWon && !youAreChallenger ? "text-gaffer-electric" : "text-white/80"}>
                <LetterWave text={String(oppScore).padStart(2,"0")} glow="white" charDelay={42} liftPx={16} />
              </span>
            </h1>
            <div className="mt-6 inline-flex items-center gap-4 rounded-full p-[1.5px] bg-gradient-to-r from-gaffer-gold/40 via-white/10 to-gaffer-electric/40">
              <div className="rounded-full bg-gaffer-black px-5 py-2 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] uppercase">
                <span className="text-white/80">
                  <HoverWord glow="electric">{`${w.challenger.slice(0,6)}…${w.challenger.slice(-4)}`}</HoverWord>
                  {youAreChallenger && <span className="ml-1 text-gaffer-electric">· YOU</span>}
                </span>
                <span className="text-white/30">vs</span>
                <span className="text-white/80">
                  {w.opponent === zeroAddress
                    ? <span className="text-white/40">awaiting</span>
                    : <HoverWord glow="white">{`${w.opponent.slice(0,6)}…${w.opponent.slice(-4)}`}</HoverWord>}
                  {!youAreChallenger && youArePart && <span className="ml-1 text-gaffer-electric">· YOU</span>}
                </span>
              </div>
            </div>
          </div>

          {/* POT SUMMARY */}
          <section className="mb-14 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
            <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-6 sm:p-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
              <PotTile label="Total pot"     value={potETH.toFixed(4)}     tone="gold" />
              <PotTile label="Protocol fee"  value={feeETH.toFixed(4)}     tone="white" />
              <PotTile label="Winner takes"  value={payoutETH.toFixed(4)}  tone="electric" />
              <PotTile label="Stage mult."   value={`${mult}×`}            tone="gold" />
            </div>
          </section>

          {/* SIDE-BY-SIDE BREAKDOWN */}
          {challengerSquad.length === 5 && opponentSquad.length === 5 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
              <SquadBreakdown
                handle={`${w.challenger.slice(0,6)}…${w.challenger.slice(-4)}`}
                isWinner={w.status === 2 && w.winner.toLowerCase() === w.challenger.toLowerCase()}
                total={chalScore}
                squad={challengerSquad}
              />
              <SquadBreakdown
                handle={`${w.opponent.slice(0,6)}…${w.opponent.slice(-4)}`}
                isWinner={w.status === 2 && w.winner.toLowerCase() === w.opponent.toLowerCase()}
                total={oppScore}
                squad={opponentSquad}
              />
            </div>
          )}

          {/* OUTCOME BANNER */}
          {w.status === 2 && youArePart && (
            <div className="mt-14 text-center">
              <div className={`inline-flex items-center gap-4 rounded-full px-8 py-4 hairline animate-hot-edge ${
                youWon ? "bg-gaffer-electric/10" : "bg-gaffer-red/10"
              }`}>
                <div className={`font-display text-3xl tracking-wider ${youWon ? "text-gaffer-electric" : "text-gaffer-red"}`}>
                  {youWon ? "VICTORY" : w.winner === zeroAddress ? "DRAW" : "DEFEAT"}
                </div>
                <div className="font-display text-2xl text-white tabular-nums">
                  {youWon ? "+" : w.winner === zeroAddress ? "" : "-"}{(youWon ? payoutETH - Number(formatEther(w.stake)) : Number(formatEther(w.stake))).toFixed(4)}
                  <span className="font-mono text-[11px] tracking-[0.2em] text-white/50 ml-1">ETH</span>
                </div>
              </div>
            </div>
          )}

          {/* NEXT STEPS */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-3">
            <NextStep href="/wars"        label="Find another war"  glyph="⚔" />
            <NextStep href="/profile"     label="Your full record"  glyph="◉" />
            <NextStep href="/leaderboard" label="Climb the board"   glyph="★" />
          </div>

          <RelatedLinks current={`/war/${warIdStr}`} title="Next moves" limit={4} />
        </div>
      </main>
    </>
  );
}

// ─── PIECES ─────────────────────────────────────────────────────────────────

function SquadBreakdown({
  handle, isWinner, total, squad,
}: {
  handle: string;
  isWinner: boolean;
  total: number;
  squad: SquadEntry[];
}) {
  return (
    <div className={`rounded-[2rem] p-1.5 ${isWinner ? "bg-gradient-to-br from-gaffer-electric/60 to-gaffer-electric/0 animate-hot-edge" : "bg-white/[0.04] hairline-strong"}`}>
      <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-6">
        {/* Head */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
              Squad {isWinner && "· WINNER"}
            </div>
            <div className="font-display text-3xl text-white mt-1">
              <HoverWord glow={isWinner ? "electric" : "white"}>{handle}</HoverWord>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Total</div>
            <div className={`font-display text-5xl tabular-nums leading-none ${isWinner ? "text-gaffer-electric" : "text-white/85"}`}
              style={isWinner ? { textShadow: "0 0 24px rgba(34, 197, 141,0.4)" } : undefined}>
              {total}
            </div>
          </div>
        </div>

        {/* Squad list */}
        <div className="space-y-2">
          {squad.map((s) => (
            <SquadPlayerRow key={`${handle}-${s.id}`} s={s} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SquadPlayerRow({ s }: { s: SquadEntry }) {
  const p = pick(s.id);
  const accentColor = s.rarity === "ICON" ? "#7FE3C0" : s.rarity === "GOLD" ? "#F5D26C" : s.rarity === "SILVER" ? "#E5E5E5" : "#E0A668";
  return (
    <div className={`rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all duration-150 ${
      s.isCaptain ? "bg-gaffer-electric/10 hairline-strong" :
      s.isBench   ? "bg-white/[0.02] opacity-60" :
                    "bg-white/[0.03] hairline"
    } hover:bg-white/[0.05]`}>
      <img
        src={`/players/${s.id}.png`}
        alt=""
        className="h-10 w-10 rounded-full object-cover bg-gaffer-pitch ring-1"
        style={{ borderColor: accentColor }}
        draggable={false}
        onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm truncate">
            <HoverWord glow={s.rarity === "ICON" ? "electric" : "gold"}>{p.shortName}</HoverWord>
          </span>
          {s.isCaptain && (
            <span className="rounded-full bg-gaffer-electric text-gaffer-black px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.15em]">
              C 2×
            </span>
          )}
          {s.isBench && (
            <span className="rounded-full bg-white/15 text-white/80 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.15em]">
              BENCH 0×
            </span>
          )}
        </div>
        <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase">
          {p.position} · {s.perf}
        </div>
      </div>
      <div className="text-right">
        <div className={`font-display text-2xl tabular-nums leading-none ${s.isBench ? "text-white/30" : "text-white"}`}>
          {s.pts}
        </div>
        <div className="font-mono text-[9px] tracking-[0.18em] text-white/35 uppercase">pts</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    OPEN:      { c: "bg-gaffer-gold/15 text-gaffer-gold",       dot: "bg-gaffer-gold" },
    ACTIVE:    { c: "bg-gaffer-electric/15 text-gaffer-electric", dot: "bg-gaffer-electric" },
    RESOLVED:  { c: "bg-white/10 text-white/80",                dot: "bg-white/60" },
    CANCELLED: { c: "bg-gaffer-red/15 text-gaffer-red",         dot: "bg-gaffer-red" },
  }[status] ?? { c: "bg-white/10 text-white/80", dot: "bg-white/60" };
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 hover-lift ${cfg.c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} animate-live-dot`} />
      <span className="font-mono text-[10px] tracking-[0.22em] uppercase">{status}</span>
    </div>
  );
}

function NextStep({ href, label, glyph }: { href: string; label: string; glyph: string }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong hover-lift hover:bg-gradient-to-br hover:from-gaffer-gold/40 hover:to-transparent transition-all duration-200"
    >
      <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl text-gaffer-gold" style={{ textShadow: "0 0 12px rgba(212,175,55,0.3)" }}>{glyph}</span>
          <span className="font-display text-lg text-white group-hover:text-gaffer-gold transition-colors duration-200">{label}</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white/30 transition-all duration-200 group-hover:text-gaffer-gold group-hover:translate-x-0.5">
          <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  );
}

function PotTile({ label, value, tone }: { label: string; value: string; tone: "gold" | "electric" | "white" }) {
  const accent = { gold: "text-gaffer-gold", electric: "text-gaffer-electric", white: "text-white" }[tone];
  return (
    <div className="text-center hover-lift cursor-default">
      <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">{label}</div>
      <div className={`font-display text-3xl sm:text-4xl tabular-nums leading-none mt-2 ${accent}`}>
        {value}
        {!value.endsWith("×") && <span className="font-mono text-[11px] tracking-[0.18em] text-white/40 ml-1">ETH</span>}
      </div>
    </div>
  );
}
