"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { consumePitchEntry, playCrowd } from "@/lib/sounds";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { zeroAddress } from "viem";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { Backdrop } from "@/components/ui/Backdrop";
import { VideoBackdrop } from "@/components/ui/VideoBackdrop";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { useCountUp } from "@/lib/useCountUp";
import { useEnsureChain } from "@/lib/useEnsureChain";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import playersData from "@/data/players.json";
import { Player, Position } from "@/types";
import {
  CONTRACT_ADDRESSES,
  GAFFER_NFT_ABI,
  PLAYER_MINT_ABI,
  POSITION_NUM,
} from "@/lib/contracts";
import { getStarterIds } from "@/lib/userRoster";

const players = playersData as Player[];
const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD", "FLEX"];
const hasContracts = CONTRACT_ADDRESSES.squadWars !== zeroAddress;

type Slot = { player: Player | null };

export default function SquadBuilderPage() {
  const { address, isConnected } = useAccount();
  const [slots, setSlots] = useState<Slot[]>(Array(5).fill({ player: null }));
  const [filter, setFilter] = useState<Position | "ALL">("ALL");
  const [search, setSearch] = useState("");

  // If we just navigated in from the portal, ride the crowd cheer
  useEffect(() => {
    if (consumePitchEntry()) {
      playCrowd(4);
    }
  }, []);

  // ─── Owned roster ─────────────────────────────────────────────────────
  // Union of (a) starter-pack picks saved in localStorage and (b) the user's
  // PlayerMint NFTs on chain. This is the ONLY pool the user picks from now.
  const addressLower = address?.toLowerCase() ?? "";
  const [starterIds, setStarterIdsState] = useState<string[]>([]);
  useEffect(() => {
    if (!addressLower) { setStarterIdsState([]); return; }
    setStarterIdsState(getStarterIds(addressLower));
    // Re-read whenever localStorage may have updated (pack just claimed)
    const i = setInterval(() => setStarterIdsState(getStarterIds(addressLower)), 1500);
    return () => clearInterval(i);
  }, [addressLower]);

  // Read PlayerMint tokenIds owned by the user
  const { data: playerMintTokens } = useReadContract({
    address: CONTRACT_ADDRESSES.playerMint,
    abi: PLAYER_MINT_ABI,
    functionName: "tokensOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && hasContracts },
  });
  // Batch-fetch tokenInfo for each
  const tokenInfoCalls = useMemo(() => {
    if (!playerMintTokens) return [];
    return (playerMintTokens as readonly bigint[]).map((tid) => ({
      address: CONTRACT_ADDRESSES.playerMint,
      abi: PLAYER_MINT_ABI,
      functionName: "tokenInfo" as const,
      args: [tid] as const,
    }));
  }, [playerMintTokens]);
  const { data: tokenInfos } = useReadContracts({
    contracts: tokenInfoCalls,
    query: { enabled: tokenInfoCalls.length > 0 },
  });
  const mintedIds = useMemo(() => {
    if (!tokenInfos) return [];
    const ids: string[] = [];
    tokenInfos.forEach((r) => {
      if (r.status === "success") {
        const info = r.result as unknown as { playerId: string };
        if (info?.playerId) ids.push(info.playerId);
      }
    });
    return ids;
  }, [tokenInfos]);

  // Owned roster = unique union of starter + minted, mapped to Player records
  const ownedRoster = useMemo<Player[]>(() => {
    const set = new Set<string>([...starterIds, ...mintedIds]);
    return Array.from(set)
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is Player => !!p);
  }, [starterIds, mintedIds]);

  const filtered = useMemo(() => {
    return ownedRoster.filter((p) => {
      const matchesPos = filter === "ALL" || p.position === filter;
      const matchesSearch =
        search.length === 0 ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.nation.toLowerCase().includes(search.toLowerCase());
      return matchesPos && matchesSearch;
    });
  }, [ownedRoster, filter, search]);

  // Already-minted check
  const { data: hasMinted } = useReadContract({
    address: CONTRACT_ADDRESSES.gafferNFT,
    abi: GAFFER_NFT_ABI,
    functionName: "hasMinted",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Squad composition rules
  const filledCount = slots.filter((s) => s.player !== null).length;
  const gkCount = slots.filter((s) => s.player?.position === "GK").length;
  const isReady = filledCount === 5 && gkCount === 1;

  const validationMsg = (() => {
    if (filledCount < 5) return `${5 - filledCount} more to pick`;
    if (gkCount === 0) return "Need exactly 1 goalkeeper";
    if (gkCount > 1) return "Only 1 goalkeeper allowed";
    return "Ready to mint";
  })();

  const isInSquad = (id: string) => slots.some((s) => s.player?.id === id);

  // Track which slot was last filled (for one-shot fill animation)
  const [lastFilledIdx, setLastFilledIdx] = useState<number | null>(null);
  // Track which player card was just clicked (for flight animation)
  const [flightId, setFlightId] = useState<string | null>(null);

  function pickPlayer(p: Player) {
    if (isInSquad(p.id)) {
      setSlots((prev) => prev.map((s) => (s.player?.id === p.id ? { player: null } : s)));
      return;
    }
    const firstEmpty = slots.findIndex((s) => s.player === null);
    if (firstEmpty === -1) return;
    setSlots((prev) => {
      const next = [...prev];
      next[firstEmpty] = { player: p };
      return next;
    });
    // Trigger animations
    setLastFilledIdx(firstEmpty);
    setFlightId(p.id);
    setTimeout(() => setLastFilledIdx(null), 700);
    setTimeout(() => setFlightId(null), 420);
  }

  function clearSlot(idx: number) {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { player: null };
      return next;
    });
  }

  // Smooth-counter for header stats
  const animFilledCount = useCountUp(filledCount, 350);
  const avgRating = filledCount === 0
    ? 0
    : Math.round(slots.filter((s) => s.player).reduce((a, s) => a + (s.player?.rating ?? 0), 0) / filledCount);
  const animAvgRating = useCountUp(avgRating, 500);

  // Confetti burst when squad becomes valid
  const [celebrate, setCelebrate] = useState(false);
  const wasReady = useRef(false);
  useEffect(() => {
    if (isReady && !wasReady.current) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1400);
    }
    wasReady.current = isReady;
  }, [isReady]);

  // ─── Mint transaction ──────────────────────────────────────────────────────
  const { writeContract, data: hash, isPending: isMinting, error: writeError } =
    useWriteContract();
  const { isLoading: isConfirming, isSuccess: isMinted } =
    useWaitForTransactionReceipt({ hash });
  const { ensureChain } = useEnsureChain();

  async function handleMint() {
    if (!isReady || !address) return;
    const playerIds = slots.map((s) => s.player!.id) as [string, string, string, string, string];
    const positions = slots.map((s) => POSITION_NUM[s.player!.position]) as [
      number,
      number,
      number,
      number,
      number
    ];
    try {
      await ensureChain();
    } catch {
      return; // user rejected the network switch
    }
    writeContract({
      address: CONTRACT_ADDRESSES.gafferNFT,
      abi: GAFFER_NFT_ABI,
      functionName: "mintSquad",
      args: [playerIds, positions],
    });
  }

  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        {/* Cinematic video backdrop — full page */}
        <VideoBackdrop
          src="/videos/squad-bg.mp4"
          opacity={0.5}
          blur={2}
          overlay="hero"
          blend="luminosity"
          playbackRate={0.55}
        />
        {/* Subtle floodlights to keep brand accent */}
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-30" />
        <div className="mx-auto max-w-7xl relative">
          {/* Page header */}
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] hairline px-3 py-1">
                <span className="font-mono text-[10px] tracking-[0.22em] text-white/60 uppercase">
                  Step 01 — Draft
                </span>
              </div>
              <h1 className="mt-4 font-display text-white text-6xl sm:text-7xl leading-[0.9]">
                Build your <span className="text-gaffer-gold">five.</span>
              </h1>
              <p className="mt-3 text-white/55 max-w-xl">
                Pick exactly one goalkeeper and four outfield players. Your squad mints as 5 NFTs
                you own forever — no re-rolls.
              </p>
            </div>

            {/* Validation chip */}
            <div className="rounded-full p-1 bg-white/[0.04] hairline">
              <div
                className={`flex items-center gap-2 rounded-full px-4 py-1.5
                  ${isReady ? "bg-gaffer-electric/15 text-gaffer-electric" : "bg-white/5 text-white/70"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isReady
                      ? "bg-gaffer-electric shadow-[0_0_8px_rgba(34, 197, 141,0.8)]"
                      : "bg-white/40"
                  }`}
                />
                <span className="font-mono text-[11px] tracking-[0.15em] uppercase">
                  {validationMsg}
                </span>
              </div>
            </div>
          </div>

          {/* Already minted state */}
          {isConnected && hasMinted ? (
            <AlreadyMintedPanel />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Formation / squad slots — left rail (Asymmetric Bento) */}
              <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
                <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
                  <div className="rounded-[calc(2rem-0.375rem)] bg-gradient-to-b from-gaffer-pitch/30 via-gaffer-surface/60 to-gaffer-black hairline inner-glow p-6 relative overflow-hidden">
                    {/* Pitch lines */}
                    <div className="pointer-events-none absolute inset-6 rounded-2xl border border-gaffer-electric/10" />
                    <div className="pointer-events-none absolute left-1/2 top-6 bottom-6 w-px bg-gaffer-electric/10" />

                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
                          Your Squad
                        </div>
                        <div className="font-display text-3xl text-white mt-1 tabular-nums">
                          <span className={isReady ? "text-gaffer-electric" : ""}
                            style={isReady ? { textShadow: "0 0 16px rgba(34, 197, 141,0.4)" } : undefined}>
                            {animFilledCount}
                          </span>
                          <span className="text-white/30"> / 5</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
                          Avg rating
                        </div>
                        <div className="font-display text-3xl text-gaffer-gold mt-1 tabular-nums">
                          {animAvgRating > 0 ? animAvgRating : "—"}
                        </div>
                      </div>
                    </div>

                    {/* 5 slots */}
                    <div className="relative grid grid-cols-5 gap-2">
                      {slots.map((slot, idx) => (
                        <SquadSlot
                          key={idx}
                          slot={slot}
                          index={idx}
                          onClear={() => clearSlot(idx)}
                          justFilled={lastFilledIdx === idx}
                        />
                      ))}

                      {/* Confetti burst when squad becomes valid */}
                      {celebrate && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-30">
                          {Array.from({ length: 14 }).map((_, i) => {
                            const angle = (i / 14) * Math.PI * 2;
                            const dist = 40 + (i % 4) * 14;
                            return (
                              <span
                                key={i}
                                className="absolute h-1.5 w-1.5 rounded-sm"
                                style={{
                                  background: i % 3 === 0 ? "#22C58D" : i % 3 === 1 ? "#D4AF37" : "#FFFFFF",
                                  ["--cx" as any]: `${Math.cos(angle) * dist}px`,
                                  ["--cy" as any]: `${Math.sin(angle) * dist}px`,
                                  animation: `confetti-up 1100ms cubic-bezier(0.23, 1, 0.32, 1) forwards`,
                                  animationDelay: `${i * 20}ms`,
                                }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Position breakdown */}
                    <div className="mt-6 grid grid-cols-5 gap-2 font-mono text-[10px]">
                      {(["GK", "DEF", "MID", "FWD", "FLEX"] as Position[]).map((pos) => {
                        const count = slots.filter((s) => s.player?.position === pos).length;
                        const target = pos === "GK" ? "1" : "—";
                        return (
                          <div
                            key={pos}
                            className={`rounded-lg p-2 text-center hairline
                              ${pos === "GK" && count === 1 ? "bg-gaffer-electric/10" : "bg-white/[0.03]"}`}
                          >
                            <div className="text-white/40 tracking-[0.15em]">{pos}</div>
                            <div className="text-white text-sm mt-0.5">
                              {count}
                              <span className="text-white/30">/{target}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mint CTA */}
                    <div className="mt-6">
                      {!isConnected ? (
                        <div className="flex flex-col items-center gap-3 py-2">
                          <p className="text-white/50 text-[13px]">Connect wallet to mint</p>
                          <ConnectButton />
                        </div>
                      ) : isMinted ? (
                        <MintSuccessCTA />
                      ) : (
                        <button
                          onClick={handleMint}
                          disabled={!isReady || isMinting || isConfirming}
                          className={`group relative w-full inline-flex items-center justify-center gap-2 rounded-full
                            bg-gaffer-gold pl-6 pr-2 py-3 text-gaffer-black overflow-hidden
                            transition-transform duration-150 ease-out-strong active:scale-[0.97]
                            hover:bg-gaffer-gold-light
                            disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                            ${isReady && !isMinting && !isConfirming ? "animate-hot-edge" : ""}`}
                        >
                          {/* Gold sweep when ready */}
                          {isReady && !isMinting && !isConfirming && (
                            <span aria-hidden className="button-sweep-overlay" />
                          )}
                          <span className="relative font-semibold text-[15px] tracking-tight">
                            {isMinting
                              ? "Confirm in wallet…"
                              : isConfirming
                                ? "Minting on-chain…"
                                : isReady ? "★ MINT SQUAD" : "Mint Squad"}
                          </span>
                          <span
                            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gaffer-black/15
                              transition-transform duration-200 ease-out-strong
                              group-hover:translate-x-0.5 group-hover:-translate-y-[1px]"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </button>
                      )}

                      {writeError && (
                        <p className="mt-3 font-mono text-[11px] text-gaffer-red text-center">
                          {(writeError as Error).message.split("\n")[0]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Player browser — right side */}
              <div className="lg:col-span-7">
                {/* Filter row */}
                <div className="rounded-2xl p-1.5 bg-white/[0.04] hairline-strong mb-4">
                  <div className="rounded-xl bg-gaffer-surface/60 hairline inner-glow p-2 flex flex-wrap items-center gap-2">
                    {/* Position filter pills */}
                    <div className="flex items-center gap-1">
                      {(["ALL", ...POSITIONS.filter((p) => p !== "FLEX")] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setFilter(pos as Position | "ALL")}
                          className={`rounded-full px-3 py-1.5 font-mono text-[11px] tracking-[0.15em]
                            transition-colors duration-150
                            ${
                              filter === pos
                                ? "bg-gaffer-gold text-gaffer-black"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                            }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                    {/* Search */}
                    <div className="ml-auto flex-1 min-w-[180px] flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 hairline">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white/40">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search player or nation…"
                        className="bg-transparent text-[13px] text-white placeholder:text-white/30 outline-none w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Your owned roster — chip row */}
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/[0.04] hairline px-3 py-1">
                  <span className="font-mono text-[10px] tracking-[0.22em] text-white/55 uppercase">
                    Your roster · {ownedRoster.length} owned
                  </span>
                  {starterIds.length > 0 && (
                    <span className="font-mono text-[9px] tracking-[0.2em] rounded-full bg-gaffer-electric/15 text-gaffer-electric px-2 py-0.5 uppercase">
                      {starterIds.length} pack
                    </span>
                  )}
                  {mintedIds.length > 0 && (
                    <span className="font-mono text-[9px] tracking-[0.2em] rounded-full bg-gaffer-gold/15 text-gaffer-gold px-2 py-0.5 uppercase">
                      {mintedIds.length} minted
                    </span>
                  )}
                </div>

                {/* EMPTY ROSTER STATES */}
                {ownedRoster.length === 0 ? (
                  <EmptyRoster connected={isConnected} />
                ) : ownedRoster.length < 5 ? (
                  /* Not enough to mint yet — encourage marketplace */
                  <>
                    <NotEnoughPanel owned={ownedRoster.length} />
                    {/* Still show what they DO have so they can familiarize */}
                    <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 opacity-90">
                      {filtered.map((p, i) => (
                        <div key={p.id} className="reveal flex justify-center" style={{ ["--stagger-delay" as any]: `${Math.min(i * 18, 360)}ms` }}>
                          <PlayerCard player={p} rarity="BRONZE" size="sm" onClick={() => {}} />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  /* Player grid — pickable */
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filtered.map((p, i) => {
                      const selected = isInSquad(p.id);
                      const flying = flightId === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`reveal flex justify-center ${flying ? "animate-card-flight" : ""}`}
                          style={{ ["--stagger-delay" as any]: `${Math.min(i * 18, 360)}ms` }}
                        >
                          <PlayerCard
                            player={p}
                            rarity="BRONZE"
                            size="sm"
                            selected={selected}
                            onClick={() => pickPlayer(p)}
                          />
                        </div>
                      );
                    })}

                    {filtered.length === 0 && (
                      <div className="col-span-full text-center py-16 text-white/40 font-mono text-sm">
                        No owned players match — clear filters.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <RelatedLinks current="/squad" />
        </div>
      </main>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SquadSlot({
  slot,
  index,
  onClear,
  justFilled,
}: {
  slot: Slot;
  index: number;
  onClear: () => void;
  justFilled: boolean;
}) {
  if (slot.player) {
    return (
      <button
        onClick={onClear}
        className={`group relative aspect-[3/4] rounded-xl overflow-hidden
          transition-transform duration-150 ease-out-strong active:scale-[0.95]
          ${justFilled ? "animate-slot-fill" : ""}`}
        style={{ perspective: "800px" }}
        title="Click to remove"
      >
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-gaffer-pitch via-gaffer-surface to-gaffer-black hairline-strong inner-glow" />

        {/* Player face mini-bg */}
        <img
          src={`/players/${slot.player.id}.png`}
          alt=""
          className="absolute inset-0 m-auto h-3/4 w-auto opacity-75 object-contain object-bottom"
          draggable={false}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />

        <div className="relative h-full flex flex-col items-center justify-end p-1.5 bg-gradient-to-t from-black/60 to-transparent">
          <div className="font-mono text-[8px] tracking-[0.15em] text-gaffer-gold/80">
            {slot.player.position}
          </div>
          <div className="font-display text-white text-base mt-1 text-center leading-tight line-clamp-2">
            {slot.player.shortName.split(" ").pop()?.toUpperCase()}
          </div>
          <div className="font-mono text-[9px] text-white/40 mt-0.5">
            {slot.player.rating} OVR
          </div>
        </div>

        {/* Ring flash overlay on fill */}
        {justFilled && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{
              animation: "ready-ring 700ms ease-out forwards",
            }}
          />
        )}

        {/* Hover X overlay */}
        <div className="absolute inset-0 bg-gaffer-red/80 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
          <span className="text-white font-mono text-[10px] tracking-[0.2em]">REMOVE</span>
        </div>
      </button>
    );
  }
  return (
    <div className="aspect-[3/4] rounded-xl border border-dashed border-white/15 flex items-center justify-center text-white/20 transition-colors duration-200 hover:border-white/30">
      <span className="font-display text-2xl">{index + 1}</span>
    </div>
  );
}

function AlreadyMintedPanel() {
  return (
    <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
      <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow p-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-gaffer-electric/10 text-gaffer-electric px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-gaffer-electric shadow-[0_0_8px_rgba(34, 197, 141,0.8)]" />
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase">Squad already minted</span>
        </div>
        <h2 className="mt-6 font-display text-white text-5xl sm:text-6xl">
          Your eleven, locked in.
        </h2>
        <p className="mt-3 text-white/55 max-w-md mx-auto">
          You've already drafted your World Cup squad. Time to put it to work — find an opponent
          and stake on the next matchday.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/wars"
            className="group inline-flex items-center gap-2 rounded-full bg-gaffer-gold pl-6 pr-2 py-2 text-gaffer-black
              transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light"
          >
            <span className="font-semibold text-[14px]">Enter Squad Wars</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gaffer-black/15
              transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyRoster({ connected }: { connected: boolean }) {
  return (
    <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
      <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow p-10 text-center">
        <div className="font-mono text-[10px] tracking-[0.32em] text-gaffer-electric uppercase mb-2">
          {connected ? "★ NO PLAYERS YET ★" : "★ CONNECT TO START ★"}
        </div>
        <h2 className="font-display text-white text-4xl sm:text-5xl leading-tight">
          {connected ? <>Claim your <span className="text-gaffer-electric">free starter pack.</span></> : <>Connect a wallet to play.</>}
        </h2>
        <p className="mt-3 text-white/55 max-w-md mx-auto text-sm">
          {connected
            ? "Head to Manager HQ — your first 5 low-tier players drop the moment you arrive."
            : "Every wallet gets a free starter pack with 5 players. After that, you mint individuals from the marketplace."}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {connected ? (
            <Link href="/play" className="group inline-flex items-center gap-2 rounded-full bg-gaffer-electric pl-6 pr-2 py-2.5 text-gaffer-black hover:brightness-110 transition-transform duration-150 ease-out-strong active:scale-[0.97] animate-hot-edge">
              <span className="font-display text-base tracking-wider">OPEN MY PACK</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gaffer-black/15">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </Link>
          ) : (
            <ConnectButton />
          )}
          <Link href="/marketplace" className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/55 hover:text-gaffer-gold transition-colors">
            Browse marketplace →
          </Link>
        </div>
      </div>
    </div>
  );
}

function NotEnoughPanel({ owned }: { owned: number }) {
  return (
    <div className="rounded-2xl p-[1.5px] bg-gradient-to-br from-gaffer-gold/40 via-white/10 to-transparent">
      <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gaffer-gold/15 text-gaffer-gold font-display text-xl">!</span>
          <div className="flex-1">
            <div className="font-display text-lg text-white leading-tight">You need 5 to mint your squad</div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-white/50 uppercase mt-1">
              You own <span className="text-gaffer-electric">{owned}</span> / 5 — pick up more in the marketplace.
            </div>
          </div>
          <Link href="/marketplace" className="rounded-full bg-gaffer-gold px-4 py-2 text-gaffer-black font-display text-sm tracking-wider transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light">
            MARKET →
          </Link>
        </div>
      </div>
    </div>
  );
}

function MintSuccessCTA() {
  return (
    <div className="rounded-2xl bg-gaffer-electric/10 hairline-strong p-4 text-center">
      <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-electric uppercase mb-2">
        Squad Minted
      </div>
      <Link
        href="/wars"
        className="inline-flex items-center gap-2 font-semibold text-white text-sm hover:text-gaffer-gold transition-colors"
      >
        Enter Squad Wars →
      </Link>
    </div>
  );
}
