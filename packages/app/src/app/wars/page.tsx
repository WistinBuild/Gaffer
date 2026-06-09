"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseEther, formatEther, zeroAddress, decodeEventLog, type Address } from "viem";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import {
  CONTRACT_ADDRESSES,
  SQUAD_WARS_ABI,
  GAFFER_NFT_ABI,
  WAR_STATUS_LABEL,
} from "@/lib/contracts";
import playersData from "@/data/players.json";
import { Player } from "@/types";

const players = playersData as Player[];
const pick = (id: string) => players.find((p) => p.id === id)!;

const hasContracts = CONTRACT_ADDRESSES.squadWars !== zeroAddress;

// Scan war IDs 1..WAR_SCAN_LIMIT via multicall to enumerate every war
const WAR_SCAN_LIMIT = 30;

// On-chain War shape (matches SquadWars.getWar return)
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
  status: number; // 0=Open, 1=Active, 2=Resolved, 3=Cancelled
  winner: Address;
  decisionLocked: boolean;
}
function truncAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function WarsPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const me = address?.toLowerCase();

  // ─── On-chain reads ──────────────────────────────────────────────────────
  const { data: wins, refetch: refetchWins } = useReadContract({
    address: CONTRACT_ADDRESSES.squadWars,
    abi: SQUAD_WARS_ABI,
    functionName: "wins",
    args: address ? [address] : undefined,
    query: { enabled: !!address && hasContracts },
  });
  const { data: losses, refetch: refetchLosses } = useReadContract({
    address: CONTRACT_ADDRESSES.squadWars,
    abi: SQUAD_WARS_ABI,
    functionName: "losses",
    args: address ? [address] : undefined,
    query: { enabled: !!address && hasContracts },
  });
  const { data: hasMinted } = useReadContract({
    address: CONTRACT_ADDRESSES.gafferNFT,
    abi: GAFFER_NFT_ABI,
    functionName: "hasMinted",
    args: address ? [address] : undefined,
    query: { enabled: !!address && hasContracts },
  });

  // ─── Scan ALL wars via multicall (IDs 1..WAR_SCAN_LIMIT) ────────────────
  const warContracts = useMemo(
    () =>
      Array.from({ length: WAR_SCAN_LIMIT }, (_, i) => ({
        address: CONTRACT_ADDRESSES.squadWars,
        abi: SQUAD_WARS_ABI,
        functionName: "getWar" as const,
        args: [BigInt(i + 1)] as const,
      })),
    [],
  );

  const { data: warResults, refetch: refetchWars } = useReadContracts({
    contracts: warContracts,
    query: { enabled: hasContracts },
  });

  // Parse — keep only wars that actually exist (challenger != zero)
  const allWars: ChainWar[] = useMemo(() => {
    if (!warResults) return [];
    return warResults
      .map((r) => (r.status === "success" ? (r.result as unknown as ChainWar) : null))
      .filter((w): w is ChainWar => w !== null && w.challenger !== zeroAddress);
  }, [warResults]);

  const openWars = useMemo(() => allWars.filter((w) => w.status === 0), [allWars]);
  const myActiveWar = useMemo(
    () => allWars.find((w) => w.status === 1 && (w.challenger.toLowerCase() === me || w.opponent.toLowerCase() === me)),
    [allWars, me],
  );
  const myResolvedWars = useMemo(
    () =>
      allWars
        .filter((w) => w.status === 2 && (w.challenger.toLowerCase() === me || w.opponent.toLowerCase() === me))
        .sort((a, b) => Number(b.id - a.id)), // newest first
    [allWars, me],
  );

  const winsN = Number(wins ?? BigInt(0));
  const lossN = Number(losses ?? BigInt(0));
  const totalGames = winsN + lossN;
  const winRate = totalGames === 0 ? 0 : Math.round((winsN / totalGames) * 100);

  // ─── Create war state ────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createMD, setCreateMD] = useState(4);
  const [createStake, setCreateStake] = useState("0.01");
  const [challengeMode, setChallengeMode] = useState<"human" | "bot">("human");
  const [botPhase, setBotPhase] = useState<"idle" | "awaiting-bot" | "ready" | "error">("idle");
  const [botError, setBotError] = useState<string | null>(null);

  const publicClient = usePublicClient();
  const { writeContract, data: txHash, isPending: txSending, error: txError } =
    useWriteContract();
  const { data: txReceipt, isLoading: txConfirming, isSuccess: txDone } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Refetch all war state when a tx confirms (creates / accepts / locks)
  useEffect(() => {
    if (txDone) {
      refetchWars();
      refetchWins();
      refetchLosses();
    }
  }, [txDone, refetchWars, refetchWins, refetchLosses]);

  function handleCreate() {
    if (!hasContracts) return alert("Contracts not deployed yet — set NEXT_PUBLIC_*_ADDRESS in .env.local");
    setChallengeMode("human");
    setBotError(null);
    writeContract({
      address: CONTRACT_ADDRESSES.squadWars,
      abi: SQUAD_WARS_ABI,
      functionName: "createWar",
      args: [BigInt(createMD)],
      value: parseEther(createStake),
    });
  }

  function handleChallengeBot() {
    if (!hasContracts) return alert("Contracts not deployed yet");
    setChallengeMode("bot");
    setBotPhase("idle");
    setBotError(null);
    writeContract({
      address: CONTRACT_ADDRESSES.squadWars,
      abi: SQUAD_WARS_ABI,
      functionName: "createWar",
      args: [BigInt(createMD)],
      value: parseEther(createStake),
    });
  }

  // After the createWar tx confirms in bot mode: extract warId from the
  // WarCreated event, then ask the backend bot to acceptWar + lockDecision.
  useEffect(() => {
    if (!txDone || !txReceipt || challengeMode !== "bot" || botPhase !== "idle") return;
    let warId: bigint | null = null;
    for (const log of txReceipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: SQUAD_WARS_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "WarCreated") {
          warId = (decoded.args as { warId: bigint }).warId;
          break;
        }
      } catch { /* not a SquadWars event */ }
    }
    if (warId === null) {
      setBotError("Couldn't read war id from the transaction.");
      setBotPhase("error");
      return;
    }
    const stakeWei = parseEther(createStake).toString();
    const wid = warId;
    (async () => {
      setBotPhase("awaiting-bot");
      try {
        const res = await fetch("/api/bot/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ warId: wid.toString(), stakeWei }),
        });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || `bot/challenge ${res.status}`);
        setBotPhase("ready");
        // Stash setup hint so /squad-setup default captain matches the user's choice slot
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`bot_war_${wid}`, "1");
        }
        router.push(`/squad-setup/${wid}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setBotError(msg);
        setBotPhase("error");
      }
    })();
  }, [txDone, txReceipt, challengeMode, botPhase, createStake, router]);

  function handleAccept(warId: bigint, stake: bigint) {
    if (!hasContracts) return alert("Contracts not deployed yet");
    writeContract({
      address: CONTRACT_ADDRESSES.squadWars,
      abi: SQUAD_WARS_ABI,
      functionName: "acceptWar",
      args: [warId],
      value: stake,
    });
  }

  // Decision lock state
  const [captainSlot, setCaptainSlot] = useState<number | null>(null);
  const [benchedSlot, setBenchedSlot] = useState<number | null>(null);

  function lockDecision(warId: bigint) {
    if (captainSlot === null || benchedSlot === null) return;
    writeContract({
      address: CONTRACT_ADDRESSES.squadWars,
      abi: SQUAD_WARS_ABI,
      functionName: "lockDecision",
      args: [warId, captainSlot, benchedSlot],
    });
  }

  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        <Backdrop
          src={FOOTBALL_IMAGERY.tactics}
          opacity={0.25}
          blur={4}
          overlay="hero"
          blend="luminosity"
          scale={1.05}
        />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-30" />

        <div className="relative mx-auto max-w-7xl">
          {/* ─── HEADER ────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gaffer-red/15 hairline px-3 py-1 hover-lift">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gaffer-red animate-live-dot" />
                <span className="font-mono text-[10px] tracking-[0.22em] text-white/80 uppercase">
                  Squad Wars · Matchday 4
                </span>
              </div>
              <h1 className="mt-5 font-display text-white text-6xl sm:text-8xl leading-[0.88]">
                <LetterWave text="Pick" glow="white" charDelay={28} liftPx={10} />{" "}
                <span className="text-gaffer-electric">
                  <LetterWave text="your fight." glow="electric" charDelay={26} liftPx={10} />
                </span>
              </h1>
              <p className="mt-3 text-white/55 max-w-xl">
                Stake ETH. Outscore your opponent on matchday. Winner takes 95% of the pot.
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              {/* Manager stat strip */}
              {isConnected && (
                <div className="rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong">
                  <div className="rounded-[14px] bg-gaffer-surface/70 hairline inner-glow px-5 py-3 flex items-center gap-6 font-mono text-xs">
                    <Stat label="W" value={winsN} color="text-gaffer-electric" />
                    <span className="text-white/20">/</span>
                    <Stat label="L" value={lossN} color="text-gaffer-red" />
                    <span className="text-white/20">·</span>
                    <Stat label="WR" value={`${winRate}%`} color="text-gaffer-gold" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setChallengeMode("bot"); setShowCreate(true); }}
                  disabled={!isConnected || botPhase === "awaiting-bot"}
                  className="group inline-flex items-center gap-2 rounded-full bg-gaffer-electric pl-6 pr-2 py-2.5 text-gaffer-black
                    transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed animate-hot-edge"
                >
                  <span className="font-display text-lg tracking-wider">
                    {botPhase === "awaiting-bot" ? "BOT STAKING…" : "CHALLENGE BOT"}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gaffer-black/15 transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
                    <Arrow />
                  </span>
                </button>
                <button
                  onClick={() => { setChallengeMode("human"); setShowCreate(true); }}
                  className="group inline-flex items-center gap-2 rounded-full bg-gaffer-gold pl-6 pr-2 py-2.5 text-gaffer-black
                    transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light"
                >
                  <span className="font-display text-lg tracking-wider">OPEN WAR</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gaffer-black/15 transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
                    <Arrow />
                  </span>
                </button>
              </div>
              {botError && (
                <div className="rounded-xl bg-gaffer-red/10 hairline px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-gaffer-red/90 max-w-[28ch] text-right uppercase">
                  Bot couldn't stake: {botError.slice(0, 80)}
                </div>
              )}
            </div>
          </div>

          {/* ─── NOT CONNECTED STATE ──────────────────────────────────── */}
          {!isConnected && (
            <div className="mt-16 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
              <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-12 text-center">
                <h2 className="font-display text-white text-4xl sm:text-5xl">Connect to enter the war room.</h2>
                <p className="mt-2 text-white/55">You need a wallet + a minted squad to challenge or accept.</p>
                <div className="mt-6 inline-block">
                  <ConnectButton />
                </div>
              </div>
            </div>
          )}

          {/* ─── MY ACTIVE WAR — captain / bench decision ──────────── */}
          {isConnected && myActiveWar && (
            <section className="mt-16">
              <SectionTitle
                eyebrow={<><Dot /> YOUR ACTIVE WAR</>}
                title={<>Lock your <span className="text-gaffer-gold">captain.</span></>}
              />
              <ActiveWarCard
                war={myActiveWar}
                me={me}
                captainSlot={captainSlot}
                benchedSlot={benchedSlot}
                onCaptain={setCaptainSlot}
                onBench={setBenchedSlot}
                onLock={() => lockDecision(myActiveWar.id)}
                locking={txSending || txConfirming}
              />
            </section>
          )}

          {/* ─── OPEN WARS — browse (real on-chain) ─────────────────── */}
          <section className="mt-20">
            <SectionTitle
              eyebrow={<><Dot /> OPEN WARS · {openWars.length}</>}
              title={<>The <span className="text-gaffer-electric">battle list.</span></>}
              right={
                <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
                  Live · Base Sepolia
                </div>
              }
            />
            {openWars.length === 0 ? (
              <div className="mt-8 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
                <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow p-10 text-center">
                  <div className="font-display text-white text-3xl">No open wars on-chain yet.</div>
                  <p className="mt-2 text-white/55">Be the first manager to post a challenge.</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-gaffer-gold pl-5 pr-2 py-2 text-gaffer-black transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light"
                  >
                    <span className="font-display text-base tracking-wider">CREATE WAR</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gaffer-black/15"><Arrow size={11} /></span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {openWars.map((w, i) => {
                  const isMine = w.challenger.toLowerCase() === me;
                  return (
                    <div key={String(w.id)} className="reveal" style={{ ["--stagger-delay" as any]: `${i * 60}ms` }}>
                      <OpenWarCard
                        war={w}
                        isMine={isMine}
                        onAccept={() => {
                          if (isMine) return;
                          handleAccept(w.id, w.stake);
                          router.push(`/squad-setup/${w.id}`);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ─── RECENTLY RESOLVED — real on-chain history ──────────── */}
          {isConnected && myResolvedWars.length > 0 && (
            <section className="mt-20">
              <SectionTitle
                eyebrow={<>RECENT RESULTS · {myResolvedWars.length}</>}
                title={<>Your <span className="text-gaffer-gold">history.</span></>}
                right={
                  <Link href="/profile" className="font-mono text-[12px] tracking-[0.2em] uppercase text-white/60 hover:text-gaffer-gold transition-colors">
                    Full profile →
                  </Link>
                }
              />
              <div className="mt-8 rounded-[1.5rem] p-1.5 bg-white/[0.04] hairline-strong">
                <div className="rounded-[calc(1.5rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow overflow-hidden">
                  {myResolvedWars.map((w, i) => (
                    <ResolvedRowChain
                      key={String(w.id)}
                      war={w}
                      me={me}
                      last={i === myResolvedWars.length - 1}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* TX status banner */}
          {(txSending || txConfirming || txDone) && (
            <div className="mt-8 rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong">
              <div className="rounded-[14px] bg-gaffer-surface/80 px-5 py-3 flex items-center justify-between gap-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${txDone ? "bg-gaffer-electric animate-live-dot" : "bg-gaffer-gold animate-live-dot"}`} />
                  <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/80">
                    {txDone ? "Confirmed on Base" : txConfirming ? "Confirming…" : "Awaiting wallet…"}
                  </span>
                </div>
                {txHash && (
                  <a href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer"
                     className="font-mono text-[10px] tracking-[0.22em] uppercase text-gaffer-gold hover:text-white">
                    {String(txHash).slice(0,10)}…
                  </a>
                )}
              </div>
            </div>
          )}
          {txError && (
            <div className="mt-3 rounded-xl bg-gaffer-red/10 hairline px-5 py-3 font-mono text-[11px] text-gaffer-red">
              {(txError as Error).message.split("\n")[0]}
            </div>
          )}

          {/* ─── RELATED — cross-link to other pages ─────────────────── */}
          <RelatedLinks current="/wars" />
        </div>

        {/* ─── CREATE WAR MODAL ───────────────────────────────────── */}
        {showCreate && (
          <CreateWarModal
            matchday={createMD}
            stake={createStake}
            onMD={setCreateMD}
            onStake={setCreateStake}
            onClose={() => setShowCreate(false)}
            onCreate={challengeMode === "bot" ? handleChallengeBot : handleCreate}
            sending={txSending || txConfirming || botPhase === "awaiting-bot"}
            done={txDone && challengeMode === "human"}
            mode={challengeMode}
            botPhase={botPhase}
          />
        )}
      </main>
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function SectionTitle({
  eyebrow, title, right,
}: { eyebrow: React.ReactNode; title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-4">
      <div>
        <div className="reveal inline-flex items-center gap-2 rounded-full bg-white/[0.04] hairline px-3 py-1 font-mono text-[10px] tracking-[0.22em] text-white/70 uppercase hover-lift">
          {eyebrow}
        </div>
        <h2 className="reveal mt-4 font-display text-white text-4xl sm:text-5xl leading-[0.9]" style={{ ["--stagger-delay" as any]: "100ms" }}>
          {title}
        </h2>
      </div>
      {right && <div className="reveal" style={{ ["--stagger-delay" as any]: "180ms" }}>{right}</div>}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-white/30 tracking-[0.2em]">{label}</span>
      <span className={`font-display text-2xl tabular-nums leading-none ${color}`}>{value}</span>
    </div>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-gaffer-electric animate-live-dot mr-1" />;
}

function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ActiveWarCard({
  war, me, captainSlot, benchedSlot, onCaptain, onBench, onLock, locking,
}: {
  war: ChainWar;
  me?: string;
  captainSlot: number | null;
  benchedSlot: number | null;
  onCaptain: (s: number | null) => void;
  onBench: (s: number | null) => void;
  onLock: () => void;
  locking: boolean;
}) {
  const ready = captainSlot !== null && benchedSlot !== null && captainSlot !== benchedSlot;
  const youAreChallenger = war.challenger.toLowerCase() === me;
  const opponent = youAreChallenger ? war.opponent : war.challenger;
  const stakeETH = Number(formatEther(war.stake));
  const potETH = stakeETH * 2;

  // We don't read each player's NFT here yet; show 5 slot placeholders + names from mock squad as visual stand-in
  const placeholderSquad = ["alisson", "van_dijk", "rodri", "bellingham", "mbappe"];

  return (
    <div className="mt-8 rounded-[2rem] p-1.5 bg-gradient-to-r from-gaffer-gold/60 via-white/10 to-gaffer-electric/40 animate-hot-edge">
      <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-gold uppercase">War #{String(war.id)} · Active · MD{String(war.matchday)}</div>
            <div className="mt-2 font-display text-3xl sm:text-4xl text-white">
              YOU <span className="text-white/30">vs</span>{" "}
              <HoverWord glow="electric">{truncAddr(opponent)}</HoverWord>
            </div>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">Pot</div>
              <div className="font-display text-3xl text-gaffer-gold tabular-nums leading-none">
                {potETH.toFixed(3)}
                <span className="font-mono text-[10px] tracking-[0.18em] text-white/40 ml-1">ETH</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">Stake</div>
              <div className="font-mono text-xl text-white tabular-nums leading-none">
                {stakeETH.toFixed(3)}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 text-white/60 text-[14px]">
          <span className="text-gaffer-gold">Captain</span> earns 2× points · <span className="text-white/80">Bench</span> earns 0 · the rest score 1×.
        </p>

        <div className="mt-6 grid grid-cols-5 gap-3">
          {placeholderSquad.map((id, idx) => {
            const isCapt = captainSlot === idx;
            const isBench = benchedSlot === idx;
            return (
              <div key={id} className="flex flex-col items-center gap-2">
                <div onClick={() => { if (isCapt) onCaptain(null); else onCaptain(idx); if (isBench) onBench(null); }} className="cursor-pointer">
                  <PlayerCard
                    player={pick(id)}
                    rarity={id === "mbappe" ? "ICON" : ["van_dijk","bellingham","rodri"].includes(id) ? "GOLD" : "SILVER"}
                    size="sm"
                    isCaptain={isCapt}
                    isBenched={isBench}
                    tilt={false}
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onCaptain(isCapt ? null : idx)}
                    className={`px-2 py-1 rounded-full font-mono text-[9px] tracking-[0.18em] font-bold transition-all duration-150 ease-out-strong active:scale-95 ${
                      isCapt
                        ? "bg-gaffer-electric text-gaffer-black shadow-[0_0_12px_rgba(34, 197, 141,0.5)]"
                        : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    C
                  </button>
                  <button
                    onClick={() => onBench(isBench ? null : idx)}
                    disabled={isCapt}
                    className={`px-2 py-1 rounded-full font-mono text-[9px] tracking-[0.18em] font-bold transition-all duration-150 ease-out-strong active:scale-95 disabled:opacity-30 ${
                      isBench
                        ? "bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                        : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    B
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* lock CTA */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="font-mono text-[11px] tracking-[0.2em] text-white/40 uppercase">
            {!ready ? "Pick a captain + a different bench player" : "Locked once you sign · cannot be changed"}
          </div>
          <button
            onClick={onLock}
            disabled={!ready || locking}
            className="group inline-flex items-center gap-2 rounded-full bg-gaffer-electric pl-6 pr-2 py-2.5 text-gaffer-black
              transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:brightness-110
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 animate-hot-edge"
          >
            <span className="font-display text-base tracking-wider">
              {locking ? "LOCKING…" : "LOCK DECISION"}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gaffer-black/15 transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5">
              <Arrow size={12} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function OpenWarCard({
  war, isMine, onAccept,
}: {
  war: ChainWar;
  isMine: boolean;
  onAccept: () => void;
}) {
  const stakeETH = Number(formatEther(war.stake));
  return (
    <div className={`group rounded-2xl p-[1.5px] hover-lift ${
      isMine ? "bg-gradient-to-br from-gaffer-electric/40 via-white/10 to-transparent animate-hot-edge"
             : "bg-white/[0.04] hairline-strong hover:bg-gradient-to-br hover:from-gaffer-gold/30 hover:to-gaffer-electric/20"
    }`}>
      <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow backdrop-blur-sm p-5 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">
              WAR #{String(war.id)} {isMine && <span className="text-gaffer-electric ml-1">· YOURS</span>}
            </div>
            <div className="mt-1 font-display text-2xl text-white">
              <HoverWord glow="white">{truncAddr(war.challenger)}</HoverWord>
            </div>
          </div>
          <div className="rounded-full bg-white/5 px-2 py-1 font-mono text-[10px] tracking-[0.18em] text-white/60">
            MD{String(war.matchday)}
          </div>
        </div>

        {/* Status */}
        <div className="rounded-xl bg-black/30 hairline p-3 flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-gaffer-gold animate-live-dot" />
          <div className="font-mono text-[10px] tracking-[0.18em] text-gaffer-gold/80 uppercase">Awaiting opponent</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase">Stake</div>
            <div className="font-display text-3xl text-gaffer-gold tabular-nums leading-none mt-1">
              {stakeETH.toFixed(3)}
              <span className="font-mono text-[10px] tracking-[0.18em] text-white/40 ml-1">ETH</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase">Winner takes</div>
            <div className="font-mono text-lg text-gaffer-electric tabular-nums leading-none mt-1.5">
              {(stakeETH * 2 * 0.95).toFixed(4)}
            </div>
          </div>
        </div>

        <button
          onClick={onAccept}
          disabled={isMine}
          className="w-full rounded-full bg-white/5 hairline py-2.5 font-display text-base tracking-wider text-white/85
            transition-all duration-150 ease-out-strong active:scale-[0.97]
            hover:bg-gaffer-gold hover:text-gaffer-black
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:text-white/85"
        >
          {isMine ? "WAITING FOR OPPONENT…" : `ACCEPT · ${stakeETH.toFixed(3)} ETH`}
        </button>
      </div>
    </div>
  );
}

function ResolvedRowChain({ war, me, last }: { war: ChainWar; me?: string; last: boolean }) {
  const youAreChallenger = war.challenger.toLowerCase() === me;
  const youWon = war.winner.toLowerCase() === me;
  const isDraw = war.winner === zeroAddress;
  const opp = youAreChallenger ? war.opponent : war.challenger;
  const yourScore = youAreChallenger ? war.challengerScore : war.opponentScore;
  const theirScore = youAreChallenger ? war.opponentScore : war.challengerScore;
  const stakeETH = Number(formatEther(war.stake));
  const profit = isDraw
    ? 0
    : youWon
      ? stakeETH * 2 * 0.95 - stakeETH // net ETH gained
      : -stakeETH;
  const result: "W" | "L" | "D" = isDraw ? "D" : youWon ? "W" : "L";

  return (
    <div className={`grid grid-cols-12 gap-4 items-center px-6 py-5 hover-lift hover:bg-white/[0.02] ${!last ? "border-b border-white/5" : ""}`}>
      <div className="col-span-1">
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-full font-display text-lg ${
          youWon ? "bg-gaffer-electric/15 text-gaffer-electric ring-1 ring-gaffer-electric/40"
          : isDraw ? "bg-white/10 text-white/70 ring-1 ring-white/20"
          : "bg-gaffer-red/15 text-gaffer-red ring-1 ring-gaffer-red/40"
        }`}>
          {result}
        </div>
      </div>
      <div className="col-span-4">
        <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase">War #{String(war.id)} · MD{String(war.matchday)}</div>
        <div className="font-semibold text-white">
          <HoverWord glow="white">{truncAddr(opp)}</HoverWord>
        </div>
      </div>
      <div className="col-span-4 text-center">
        <div className="font-display text-3xl text-white tabular-nums leading-none">
          {String(yourScore)}–{String(theirScore)}
        </div>
        <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase mt-1">final</div>
      </div>
      <div className="col-span-3 text-right">
        <div className={`font-display text-2xl tabular-nums leading-none ${
          profit > 0 ? "text-gaffer-electric" : profit < 0 ? "text-gaffer-red" : "text-white/70"
        }`}>
          {profit > 0 ? "+" : ""}{profit.toFixed(4)}
        </div>
        <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase mt-1">ETH</div>
      </div>
    </div>
  );
}

function CreateWarModal({
  matchday, stake, onMD, onStake, onClose, onCreate, sending, done, mode, botPhase,
}: {
  matchday: number; stake: string;
  onMD: (n: number) => void; onStake: (s: string) => void;
  onClose: () => void; onCreate: () => void;
  sending: boolean; done: boolean;
  mode: "human" | "bot";
  botPhase: "idle" | "awaiting-bot" | "ready" | "error";
}) {
  const isBot = mode === "bot";
  useEffect(() => {
    if (done) {
      const t = setTimeout(onClose, 1200);
      return () => clearTimeout(t);
    }
  }, [done, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gaffer-black/80 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-[2rem] p-1.5 bg-gradient-to-br from-gaffer-gold/40 via-white/10 to-gaffer-electric/30">
        <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface hairline inner-glow p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className={`font-mono text-[10px] tracking-[0.22em] uppercase ${isBot ? "text-gaffer-electric" : "text-gaffer-gold"}`}>
                {isBot ? "Solo · vs Bot opponent" : "New challenge · open war"}
              </div>
              <h2 className="mt-2 font-display text-white text-4xl leading-none">
                {isBot ? "CHALLENGE BOT" : "OPEN WAR"}
              </h2>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none transition-colors">×</button>
          </div>

          {done ? (
            <div className="mt-8 text-center py-8">
              <div className="font-display text-5xl text-gaffer-electric leading-none mb-2">★</div>
              <div className="font-display text-2xl text-white">War posted</div>
              <p className="text-white/55 mt-2 text-sm">Waiting for an opponent to accept.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {/* matchday */}
              <div>
                <label className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Matchday</label>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {[1,2,3,4,5].map((n) => (
                    <button
                      key={n}
                      onClick={() => onMD(n)}
                      className={`py-3 rounded-xl font-display text-2xl transition-colors duration-150 ${
                        matchday === n
                          ? "bg-gaffer-gold text-gaffer-black"
                          : "bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {/* stake */}
              <div>
                <label className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Stake (ETH)</label>
                <div className="mt-2 grid grid-cols-4 gap-2 mb-2">
                  {["0.01","0.05","0.10","0.25"].map((s) => (
                    <button
                      key={s}
                      onClick={() => onStake(s)}
                      className={`py-2 rounded-xl font-mono text-sm transition-colors duration-150 ${
                        stake === s
                          ? "bg-gaffer-gold/15 text-gaffer-gold ring-1 ring-gaffer-gold/40"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input
                  value={stake}
                  onChange={(e) => onStake(e.target.value)}
                  placeholder="0.01"
                  className="w-full bg-black/30 hairline rounded-xl px-4 py-3 text-white font-mono outline-none focus:ring-1 focus:ring-gaffer-gold/40"
                />
              </div>

              {/* potential pot */}
              <div className="rounded-xl bg-gaffer-pitch/30 hairline p-3 flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Winner takes</span>
                <span className="font-display text-2xl text-gaffer-electric tabular-nums">
                  {(Number(stake || "0") * 2 * 0.95).toFixed(4)} ETH
                </span>
              </div>

              {isBot && (
                <p className="font-mono text-[10px] tracking-[0.18em] text-white/45 leading-relaxed uppercase">
                  Bot opponent stakes the same amount from the treasury wallet.
                  Winner takes the full pot minus 5% protocol fee.
                </p>
              )}
              <button
                onClick={onCreate}
                disabled={sending || !stake}
                className={`w-full rounded-full py-3.5 font-display text-xl tracking-wider text-gaffer-black
                  transition-transform duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-50 ${
                  isBot ? "bg-gaffer-electric hover:brightness-110" : "bg-gaffer-gold hover:bg-gaffer-gold-light"
                }`}
              >
                {botPhase === "awaiting-bot"
                  ? "BOT STAKING…"
                  : sending
                    ? "POSTING…"
                    : isBot
                      ? `STAKE & CHALLENGE BOT · ${stake} ETH`
                      : `POST WAR · ${stake} ETH`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
