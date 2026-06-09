"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { toUSDC, ensureUsdcAllowance } from "@/lib/usdc";
import { useEnsureChain } from "@/lib/useEnsureChain";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import { rarityFor, priceUSDC, priceLabel, maxSupply } from "@/lib/market";
import { CONTRACT_ADDRESSES, PLAYER_MINT_ABI } from "@/lib/contracts";
import { playClick, playCoin, playSuccess, unlockAudio } from "@/lib/sounds";
import playersData from "@/data/players.json";
import { Player, Position } from "@/types";

const ALL_PLAYERS = playersData as Player[];

type RarityFilter = "ALL" | "ICON" | "GOLD" | "SILVER" | "BRONZE";
type PosFilter = "ALL" | "GK" | "DEF" | "MID" | "FWD";
type SortKey = "price-desc" | "price-asc" | "rating" | "rarity";

export default function MarketplacePage() {
  const { address, isConnected } = useAccount();
  const [rarity, setRarity] = useState<RarityFilter>("ALL");
  const [pos, setPos] = useState<PosFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("price-desc");
  const [search, setSearch] = useState("");
  const [showLegendsOnly, setShowLegendsOnly] = useState(false);

  // Mint transaction state — shared across all MarketCards via this page-level hook
  const { writeContract, data: txHash, isPending: txSending, error: txError, reset: resetTx } =
    useWriteContract();
  const { writeContractAsync: approveAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { wrongChain, ensureChain } = useEnsureChain();
  const { isLoading: txConfirming, isSuccess: txDone } = useWaitForTransactionReceipt({ hash: txHash });
  const [mintingId, setMintingId] = useState<string | null>(null);

  async function mintPlayer(playerId: string) {
    unlockAudio().then(playClick).catch(() => {});
    if (!address || !publicClient) return;
    const onchain = supplyMap[playerId];
    // Don't even ask the wallet if it's already sold out on-chain.
    if (onchain && onchain.max > 0 && onchain.minted >= onchain.max) return;
    setMintingId(playerId);
    const player = ALL_PLAYERS.find((p) => p.id === playerId)!;
    // Charge the on-chain catalog price (source of truth) when we have it; the
    // contract pulls exactly that amount, so approving the local estimate risks
    // an "insufficient allowance" revert if the two ever diverge.
    const amount = onchain?.price ?? toUSDC(priceUSDC(player).toFixed(6));
    try {
      await ensureChain();
      await ensureUsdcAllowance(publicClient, approveAsync, address, CONTRACT_ADDRESSES.playerMint, amount);
      writeContract({
        address: CONTRACT_ADDRESSES.playerMint,
        abi: PLAYER_MINT_ABI,
        functionName: "mintPlayer",
        args: [playerId],
      });
    } catch {
      setMintingId(null);
    }
  }

  // Coin + success sound when mint confirms
  useEffect(() => {
    if (txDone) {
      playCoin();
      setTimeout(() => playSuccess(), 400);
    }
  }, [txDone]);

  // Real on-chain supply — one multicall reading catalogOf() for every player.
  // `minted` is the true mint count (was previously a fake hash-based number).
  const { data: catalogData, isLoading: supplyLoading } = useReadContracts({
    contracts: ALL_PLAYERS.map((p) => ({
      address: CONTRACT_ADDRESSES.playerMint,
      abi: PLAYER_MINT_ABI,
      functionName: "catalogOf" as const,
      args: [p.id] as const,
    })),
    query: { refetchInterval: 20_000 }, // keep supply fresh as people mint
  });

  const supplyMap = useMemo(() => {
    const m: Record<string, { minted: number; max: number; price: bigint }> = {};
    if (!catalogData) return m;
    ALL_PLAYERS.forEach((p, i) => {
      const res = catalogData[i];
      if (res?.status !== "success" || !res.result) return;
      const c = res.result as { maxSupply: number | bigint; minted: number | bigint; price: bigint; exists: boolean };
      if (!c.exists) return; // not seeded in catalog
      m[p.id] = { minted: Number(c.minted), max: Number(c.maxSupply), price: BigInt(c.price) };
    });
    return m;
  }, [catalogData]);

  const filtered = useMemo(() => {
    let xs = ALL_PLAYERS.map((p) => ({
      player: p,
      rarity: rarityFor(p),
      price: priceUSDC(p),
      maxSup: maxSupply(p),
    }));

    if (showLegendsOnly) xs = xs.filter((x) => x.player.legend);
    if (rarity !== "ALL") xs = xs.filter((x) => x.rarity === rarity);
    if (pos !== "ALL") xs = xs.filter((x) => x.player.position === pos);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter(
        (x) =>
          x.player.name.toLowerCase().includes(q) ||
          x.player.nation.toLowerCase().includes(q),
      );
    }

    const RARITY_RANK = { ICON: 4, GOLD: 3, SILVER: 2, BRONZE: 1 };
    if (sort === "price-desc") xs.sort((a, b) => b.price - a.price);
    if (sort === "price-asc")  xs.sort((a, b) => a.price - b.price);
    if (sort === "rating")     xs.sort((a, b) => b.player.rating - a.player.rating);
    if (sort === "rarity")     xs.sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity]);

    return xs;
  }, [rarity, pos, sort, search, showLegendsOnly]);

  const stats = useMemo(() => {
    const all = ALL_PLAYERS.map((p) => priceUSDC(p));
    const total = all.reduce((a, b) => a + b, 0);
    const legends = ALL_PLAYERS.filter((p) => p.legend).length;
    return {
      total: ALL_PLAYERS.length,
      legends,
      marketCap: total.toFixed(2),
      floor: Math.min(...all).toFixed(3),
      ceiling: Math.max(...all).toFixed(3),
    };
  }, []);

  const featuredLegends = useMemo(
    () => ALL_PLAYERS.filter((p) => p.legend).sort((a, b) => b.rating - a.rating),
    [],
  );

  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        <Backdrop src={FOOTBALL_IMAGERY.trophy} opacity={0.22} blur={3} overlay="hero" blend="luminosity" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-30" />

        <div className="relative mx-auto max-w-7xl">
          {/* HEADER */}
          <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gaffer-gold/15 hairline px-3 py-1 hover-lift">
                <span className="text-gaffer-gold text-[12px] leading-none">◇</span>
                <span className="font-mono text-[10px] tracking-[0.22em] text-gaffer-gold uppercase">
                  The Market · {stats.total} players live
                </span>
              </div>
              <h1 className="mt-5 font-display text-white text-7xl sm:text-9xl leading-[0.85]">
                <LetterWave text="Mint" glow="white" charDelay={28} liftPx={12} />{" "}
                <span className="text-gaffer-gold">
                  <LetterWave text="legends." glow="gold" charDelay={30} liftPx={14} />
                </span>
              </h1>
              <p className="mt-4 text-white/55 max-w-xl">
                Every player is an ERC-721 on Base. Price scales with rating, scarcity, and
                whether you're buying a current star or a World Cup icon.
              </p>
            </div>

            {/* Market stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label="Players"   value={stats.total}     tone="white" />
              <StatTile label="Legends"   value={stats.legends}   tone="gold" />
              <StatTile label="Floor"     value={stats.floor}     unit="USDC" tone="electric" />
              <StatTile label="Ceiling"   value={stats.ceiling}   unit="USDC" tone="gold" />
            </div>
          </div>

          {/* FEATURED LEGENDS */}
          <section className="mb-14">
            <div className="flex items-end justify-between mb-5">
              <div>
                <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-gold/80 uppercase">★ Featured · World Cup icons</div>
                <h2 className="mt-1 font-display text-white text-3xl">The greats.</h2>
              </div>
              <button
                onClick={() => setShowLegendsOnly(!showLegendsOnly)}
                className={`font-mono text-[11px] tracking-[0.22em] uppercase transition-colors duration-150 hover-word ${
                  showLegendsOnly ? "text-gaffer-gold hover-word-gold" : "text-white/60 hover-word-white"
                }`}
              >
                {showLegendsOnly ? "← show all" : "filter legends only →"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 justify-items-center">
              {featuredLegends.map((p, i) => (
                <div key={p.id} className="reveal flex flex-col items-center gap-2" style={{ ["--stagger-delay" as any]: `${i * 60}ms` }}>
                  <PlayerCard player={p} rarity="ICON" size="sm" tilt={false} />
                  <div className="text-center">
                    <div className="font-mono text-[9px] tracking-[0.18em] text-gaffer-gold/80 uppercase">{p.era}</div>
                    <div className="font-display text-lg text-gaffer-gold tabular-nums leading-none mt-0.5" style={{ textShadow: "0 0 12px rgba(212,175,55,0.4)" }}>
                      {priceLabel(p)}
                      <span className="font-mono text-[9px] tracking-[0.15em] text-white/40 ml-1">USDC</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FILTER BAR */}
          <div className="rounded-2xl p-1.5 bg-white/[0.04] hairline-strong mb-6">
            <div className="rounded-xl bg-gaffer-surface/60 hairline inner-glow p-3 flex flex-wrap items-center gap-3">
              {/* Rarity filter */}
              <div className="flex items-center gap-1">
                {(["ALL", "ICON", "GOLD", "SILVER", "BRONZE"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRarity(r)}
                    className={`px-3 py-1.5 rounded-full font-mono text-[10px] tracking-[0.15em] uppercase transition-colors duration-150 active:scale-95 ${
                      rarity === r ? "bg-gaffer-gold text-gaffer-black" : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="h-5 w-px bg-white/10" />
              {/* Position filter */}
              <div className="flex items-center gap-1">
                {(["ALL", "GK", "DEF", "MID", "FWD"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPos(p)}
                    className={`px-3 py-1.5 rounded-full font-mono text-[10px] tracking-[0.15em] uppercase transition-colors duration-150 active:scale-95 ${
                      pos === p ? "bg-gaffer-electric/15 text-gaffer-electric ring-1 ring-gaffer-electric/40" : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="h-5 w-px bg-white/10" />
              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="bg-black/30 hairline rounded-full px-3 py-1.5 font-mono text-[10px] tracking-[0.15em] uppercase text-white/80 outline-none focus:ring-1 focus:ring-gaffer-gold/40"
              >
                <option value="price-desc" className="bg-gaffer-surface">Price ↓</option>
                <option value="price-asc"  className="bg-gaffer-surface">Price ↑</option>
                <option value="rating"     className="bg-gaffer-surface">Rating</option>
                <option value="rarity"     className="bg-gaffer-surface">Rarity</option>
              </select>
              {/* Search */}
              <div className="ml-auto flex-1 min-w-[180px] max-w-xs flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 hairline">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white/40">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Player or nation…"
                  className="bg-transparent text-[13px] text-white placeholder:text-white/30 outline-none w-full"
                />
              </div>
            </div>
          </div>

          {/* RESULTS COUNT */}
          <div className="mb-4 font-mono text-[11px] tracking-[0.22em] text-white/40 uppercase">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
            {filtered.length > 0 && (
              <>
                <span className="mx-2 text-white/20">·</span>
                <span>
                  total value{" "}
                  <span className="text-gaffer-gold">
                    {filtered.reduce((a, b) => a + b.price, 0).toFixed(2)} USDC
                  </span>
                </span>
              </>
            )}
          </div>

          {/* TRANSACTION STATUS BANNER */}
          {(txSending || txConfirming || txDone) && (
            <div className={`mb-6 rounded-2xl p-[1.5px] ${txDone ? "bg-gradient-to-r from-gaffer-electric/60 to-transparent animate-hot-edge" : "bg-white/[0.04] hairline-strong"}`}>
              <div className="rounded-[14px] bg-gaffer-surface/80 hairline inner-glow px-5 py-3 flex items-center justify-between gap-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className={`inline-block h-2 w-2 rounded-full ${txDone ? "bg-gaffer-electric animate-live-dot" : "bg-gaffer-gold animate-live-dot"}`} />
                  <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/80">
                    {txDone ? `Minted ${mintingId} on-chain` : txConfirming ? "Confirming on Base…" : "Sign the mint in your wallet"}
                  </span>
                </div>
                {txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] tracking-[0.22em] uppercase text-gaffer-gold hover:text-white transition-colors"
                  >
                    {txHash.slice(0, 8)}…{txHash.slice(-6)} ↗
                  </a>
                )}
                {txDone && (
                  <button onClick={() => { resetTx(); setMintingId(null); }} className="text-white/40 hover:text-white text-lg">×</button>
                )}
              </div>
            </div>
          )}
          {txError && (
            <div className="mb-6 rounded-2xl p-[1.5px] bg-gaffer-red/20 hairline">
              <div className="rounded-[14px] bg-gaffer-red/10 px-5 py-3 font-mono text-[11px] tracking-[0.18em] text-gaffer-red">
                Mint failed: {(txError as Error).message.split("\n")[0]}
              </div>
            </div>
          )}

          {/* GRID */}
          {filtered.length === 0 ? (
            <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
              <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow p-12 text-center">
                <div className="font-display text-3xl text-white">No matches.</div>
                <p className="mt-2 text-white/55">Try widening the filters.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((x, i) => {
                const onchain = supplyMap[x.player.id];
                const max = onchain?.max ?? x.maxSup;
                const minted = onchain?.minted ?? 0;
                const soldOut = !!onchain && max > 0 && minted >= max;
                return (
                  <div key={x.player.id} className="reveal" style={{ ["--stagger-delay" as any]: `${Math.min(i * 20, 300)}ms` }}>
                    <MarketCard
                      player={x.player}
                      rarity={x.rarity}
                      price={x.price}
                      minted={minted}
                      max={max}
                      soldOut={soldOut}
                      wrongChain={wrongChain}
                      supplyLoading={supplyLoading && !onchain}
                      onMint={() => mintPlayer(x.player.id)}
                      isMinting={mintingId === x.player.id && (txSending || txConfirming)}
                      canMint={isConnected && !txSending && !txConfirming && !soldOut}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <RelatedLinks current="/marketplace" />
        </div>
      </main>
    </>
  );
}

// ─── PIECES ─────────────────────────────────────────────────────────────────

function MarketCard({
  player, rarity, price, minted, max, soldOut, wrongChain, supplyLoading, onMint, isMinting, canMint,
}: {
  player: Player;
  rarity: "BRONZE" | "SILVER" | "GOLD" | "ICON";
  price: number;
  minted: number;
  max: number;
  soldOut: boolean;
  wrongChain: boolean;
  supplyLoading: boolean;
  onMint: () => void;
  isMinting: boolean;
  canMint: boolean;
}) {
  const supplyPct = max > 0 ? (minted / max) * 100 : 0;

  const accentColor =
    rarity === "ICON" ? "#7FE3C0" :
    rarity === "GOLD" ? "#F5D26C" :
    rarity === "SILVER" ? "#E5E5E5" : "#E0A668";

  return (
    <div className={`group rounded-2xl p-[1.5px] hover-lift transition-all duration-200 ${
      rarity === "ICON" ? "bg-gradient-to-br from-gaffer-electric/50 via-white/10 to-transparent animate-hot-edge"
      : rarity === "GOLD" ? "bg-gradient-to-br from-gaffer-gold/40 to-transparent"
      : "bg-white/[0.04] hairline-strong"
    }`}>
      <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow p-4 flex flex-col gap-3 h-full">
        {/* Card display */}
        <div className="flex justify-center -mt-1">
          <PlayerCard player={player} rarity={rarity} size="sm" tilt={false} />
        </div>

        {/* Era badge for legends */}
        {player.legend && player.era && (
          <div className="text-center -mt-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-gaffer-electric/15 px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-gaffer-electric uppercase">
              ★ ICON · {player.era}
            </span>
          </div>
        )}

        {/* Price + supply */}
        <div className="grid grid-cols-2 gap-3 px-1">
          <div>
            <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">Price</div>
            <div className="font-display text-2xl leading-none tabular-nums mt-0.5" style={{ color: accentColor, textShadow: `0 0 12px ${accentColor}33` }}>
              {priceLabel(player)}
              <span className="font-mono text-[10px] tracking-[0.18em] text-white/40 ml-1">USDC</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">Supply</div>
            <div className="font-mono text-sm text-white tabular-nums mt-0.5">
              <span style={{ color: accentColor }}>
                {supplyLoading ? "···" : minted.toLocaleString()}
              </span>
              <span className="text-white/30 mx-1">/</span>
              <span>{max.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Supply progress bar */}
        <div className="px-1">
          <div className="h-1 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full transition-all duration-700 ease-out-strong" style={{
              width: `${supplyPct}%`,
              background: `linear-gradient(to right, ${accentColor}, ${accentColor}66)`,
              boxShadow: `0 0 6px ${accentColor}66`,
            }} />
          </div>
        </div>

        {/* MINT button — calls PlayerMint.mintPlayer on-chain */}
        <button
          onClick={onMint}
          disabled={!canMint || isMinting || soldOut}
          className={`group/btn w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5
            transition-transform duration-150 ease-out-strong active:scale-[0.97] disabled:active:scale-100
            ${isMinting
              ? "bg-gaffer-gold/20 text-gaffer-gold cursor-wait"
              : soldOut
                ? "bg-white/5 hairline text-white/30 cursor-not-allowed"
                : !canMint
                  ? "bg-white/5 hairline text-white/40 cursor-not-allowed"
                  : "bg-white/5 hairline text-white/85 hover:bg-gaffer-gold hover:text-gaffer-black"
            }`}
          title={
            soldOut ? "Sold out" :
            wrongChain ? "Wallet is on the wrong network — minting will switch it" :
            (!canMint && !isMinting) ? "Connect wallet to mint" : undefined
          }
        >
          <span className="font-display text-base tracking-wider">
            {soldOut ? "SOLD OUT" : isMinting ? "MINTING…" : wrongChain ? "SWITCH NETWORK" : `MINT · ${priceLabel(player)} USDC`}
          </span>
        </button>
      </div>
    </div>
  );
}

function StatTile({ label, value, unit, tone }: { label: string; value: string | number; unit?: string; tone: "gold" | "electric" | "white" }) {
  const accent = { gold: "text-gaffer-gold", electric: "text-gaffer-electric", white: "text-white" }[tone];
  return (
    <div className="rounded-2xl p-[1px] bg-white/[0.04] hairline-strong hover-lift">
      <div className="rounded-[15px] bg-gaffer-surface/70 hairline inner-glow px-4 py-3">
        <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">{label}</div>
        <div className={`font-display text-2xl ${accent} tabular-nums leading-none mt-1`}>
          {value}
          {unit && <span className="font-mono text-[10px] tracking-[0.18em] text-white/40 ml-1">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
