"use client";

import { useState, useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { zeroAddress, formatEther, type Address } from "viem";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import { CONTRACT_ADDRESSES, SQUAD_WARS_ABI } from "@/lib/contracts";

const hasContracts = CONTRACT_ADDRESSES.squadWars !== zeroAddress;
type FilterKey = "all" | "week" | "matchday";

interface Manager {
  rank: number;
  address: Address;
  w: number;
  l: number;
  win_rate: number;
  isYou: boolean;
}

const WAR_SCAN_LIMIT = 30;

export default function LeaderboardPage() {
  const { address } = useAccount();
  const me = address?.toLowerCase();
  const [filter, setFilter] = useState<FilterKey>("all");

  // ─── Read top-50 from contract (sorted by wins internally) ───────────────
  const { data: lbData } = useReadContract({
    address: CONTRACT_ADDRESSES.squadWars,
    abi: SQUAD_WARS_ABI,
    functionName: "getLeaderboard",
    args: [BigInt(50)],
    query: { enabled: hasContracts },
  });

  const [managers, winCounts] = (lbData ?? [[], []]) as readonly [readonly Address[], readonly bigint[]];

  // Fetch losses per manager via multicall
  const lossContracts = useMemo(
    () =>
      managers.map((addr) => ({
        address: CONTRACT_ADDRESSES.squadWars,
        abi: SQUAD_WARS_ABI,
        functionName: "losses" as const,
        args: [addr] as const,
      })),
    [managers],
  );
  const { data: lossResults } = useReadContracts({
    contracts: lossContracts,
    query: { enabled: managers.length > 0 },
  });

  // Build manager list
  const board: Manager[] = useMemo(() => {
    if (managers.length === 0) return [];
    return managers
      .filter((a) => a !== zeroAddress)
      .map((addr, i) => {
        const w = Number(winCounts[i] ?? BigInt(0));
        const lossRaw = lossResults?.[i];
        const l = lossRaw?.status === "success" ? Number(lossRaw.result as unknown as bigint) : 0;
        const total = w + l;
        return {
          rank: i + 1,
          address: addr,
          w,
          l,
          win_rate: total === 0 ? 0 : Math.round((w / total) * 100),
          isYou: addr.toLowerCase() === me,
        };
      })
      .filter((m) => m.w + m.l > 0); // only managers who've played
  }, [managers, winCounts, lossResults, me]);

  // ─── Aggregate totals — scan resolved wars for stake volume ──────────────
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
  const { data: warResults } = useReadContracts({
    contracts: warContracts,
    query: { enabled: hasContracts },
  });
  const totals = useMemo(() => {
    if (!warResults) return { staked: "0.00", wars: 0, managers: 0 };
    const wars = warResults
      .map((r) => (r.status === "success" ? (r.result as any) : null))
      .filter((w) => w !== null && w.challenger !== zeroAddress);
    let staked = 0;
    const mgrSet = new Set<string>();
    wars.forEach((w: any) => {
      const stake = Number(formatEther(w.stake));
      // Both sides put up the stake once status >= 1 (Active or Resolved)
      const sides = w.status >= 1 ? 2 : 1;
      staked += stake * sides;
      mgrSet.add(w.challenger.toLowerCase());
      if (w.opponent !== zeroAddress) mgrSet.add(w.opponent.toLowerCase());
    });
    return { staked: staked.toFixed(3), wars: wars.length, managers: mgrSet.size };
  }, [warResults]);

  const podium = board.slice(0, 3);
  const rest = board.slice(3);

  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        <Backdrop src={FOOTBALL_IMAGERY.goldenHour} opacity={0.3} blur={3} overlay="hero" blend="luminosity" scale={1.05} />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-30" />

        <div className="relative mx-auto max-w-7xl">
          {/* ─── HEADER ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gaffer-gold/15 hairline px-3 py-1 hover-lift">
                <span className="text-gaffer-gold text-[12px] leading-none">★</span>
                <span className="font-mono text-[10px] tracking-[0.22em] text-gaffer-gold uppercase">
                  Hall of fame · Live
                </span>
              </div>
              <h1 className="mt-5 font-display text-white text-7xl sm:text-[10rem] leading-[0.85]">
                <LetterWave text="The" glow="white" charDelay={30} liftPx={12} />{" "}
                <span className="text-gaffer-gold">
                  <LetterWave text="board." glow="gold" charDelay={34} liftPx={14} />
                </span>
              </h1>
              <p className="mt-3 text-white/55 max-w-xl">
                Top managers ranked by total wins, win rate, and ETH profit since the tournament began.
              </p>
            </div>

            {/* Stats strip — live from chain */}
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Total staked" value={totals.staked} unit="ETH" tone="gold" />
              <StatTile label="Wars on-chain" value={totals.wars} unit="" tone="electric" />
              <StatTile label="Managers" value={totals.managers} unit="" tone="white" />
            </div>
          </div>

          {/* ─── FILTER PILLS ───────────────────────────────────────── */}
          <div className="mt-10 inline-flex rounded-full p-[1.5px] bg-white/[0.04] hairline-strong">
            <div className="rounded-full bg-gaffer-black/50 hairline p-1 flex">
              {[
                { k: "all" as const, label: "All time" },
                { k: "week" as const, label: "This week" },
                { k: "matchday" as const, label: "MD4 only" },
              ].map((f) => (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  className={`px-4 py-1.5 rounded-full font-mono text-[11px] tracking-[0.15em] uppercase transition-all duration-150 ease-out-strong active:scale-95 ${
                    filter === f.k
                      ? "bg-gaffer-gold text-gaffer-black"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── EMPTY STATE ──────────────────────────────────────── */}
          {board.length === 0 ? (
            <section className="mt-14 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
              <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow p-12 text-center">
                <div className="font-display text-white text-3xl">No managers ranked yet.</div>
                <p className="mt-2 text-white/55">First wars to resolve set the board.</p>
                <Link href="/wars" className="mt-5 inline-flex items-center gap-2 rounded-full bg-gaffer-gold pl-5 pr-2 py-2 text-gaffer-black transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light">
                  <span className="font-display text-base tracking-wider">CREATE WAR</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gaffer-black/15"><Arrow /></span>
                </Link>
              </div>
            </section>
          ) : (
            <>
          {/* ─── PODIUM (top 3) ─────────────────────────────────────── */}
          {podium.length > 0 && (
            <section className="mt-14">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {podium[1] && <PodiumCard place={2} m={podium[1]} />}
                {podium[0] && <PodiumCard place={1} m={podium[0]} />}
                {podium[2] && <PodiumCard place={3} m={podium[2]} />}
              </div>
            </section>
          )}

          {/* ─── FULL TABLE (ranks 4+) ──────────────────────────────── */}
          {rest.length > 0 && (
          <section className="mt-16">
            <div className="flex items-end justify-between mb-5">
              <h2 className="font-display text-white text-3xl">The Rest</h2>
              <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
                {rest.length} {rest.length === 1 ? "manager" : "managers"}
              </div>
            </div>

            <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
              <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 backdrop-blur-sm hairline inner-glow overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase border-b border-white/5">
                  <div className="col-span-1">#</div>
                  <div className="col-span-5">Manager</div>
                  <div className="col-span-3 text-right">W / L</div>
                  <div className="col-span-3 text-right">Win rate</div>
                </div>

                {rest.map((m, i) => (
                  <div
                    key={m.address}
                    className={`reveal grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-4 px-6 py-5 items-center
                      border-b border-white/5 last:border-b-0 hover-lift hover:bg-white/[0.02]
                      ${m.isYou ? "bg-gaffer-electric/5" : ""}`}
                    style={{ ["--stagger-delay" as any]: `${i * 60}ms` }}
                  >
                    <div className="col-span-1">
                      <span className="font-display text-2xl text-white/40 tabular-nums">
                        {String(m.rank).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="col-span-1 sm:col-span-5 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gaffer-pitch ring-1 ring-white/15 flex items-center justify-center font-mono text-[10px] text-white/50">
                        {m.address.slice(2, 4).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-base font-mono">
                          <HoverWord glow="white">{`${m.address.slice(0, 6)}…${m.address.slice(-4)}`}</HoverWord>
                          {m.isYou && <span className="ml-2 font-mono text-[9px] tracking-[0.22em] text-gaffer-electric uppercase">· YOU</span>}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-1 sm:col-span-3 text-right font-mono">
                      <span className="text-gaffer-electric tabular-nums">{m.w}</span>
                      <span className="text-white/30 mx-1">/</span>
                      <span className="text-gaffer-red tabular-nums">{m.l}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-3 flex justify-end items-center gap-2">
                      <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-gaffer-electric to-gaffer-gold" style={{ width: `${m.win_rate}%` }} />
                      </div>
                      <span className="font-mono text-xs tabular-nums text-white/80">{m.win_rate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          )}
            </>
          )}

          {/* CTA */}
          <section className="mt-20 text-center">
            <p className="text-white/55 mb-4">Think you can crack the top 10?</p>
            <Link
              href="/wars"
              className="group inline-flex items-center gap-2 rounded-full bg-gaffer-gold pl-6 pr-2 py-2.5 text-gaffer-black
                transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light animate-hot-edge"
            >
              <span className="font-display text-lg tracking-wider">FIND A WAR</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gaffer-black/15 transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
                <Arrow />
              </span>
            </Link>
          </section>

          <RelatedLinks current="/leaderboard" />
        </div>
      </main>
    </>
  );
}

// ─── PIECES ─────────────────────────────────────────────────────────────────

function StatTile({
  label, value, unit, tone,
}: { label: string; value: string | number; unit?: string; tone: "gold" | "electric" | "white" }) {
  const accent = { gold: "text-gaffer-gold", electric: "text-gaffer-electric", white: "text-white" }[tone];
  return (
    <div className="hover-lift rounded-2xl p-[1px] bg-white/[0.04] hairline-strong">
      <div className="rounded-[15px] bg-gaffer-surface/70 hairline inner-glow px-4 py-3 text-right">
        <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">{label}</div>
        <div className={`font-display text-2xl ${accent} tabular-nums leading-none mt-1`}>
          {value}
          {unit && <span className="font-mono text-[10px] tracking-[0.18em] text-white/40 ml-1">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

function PodiumCard({ place, m }: { place: 1 | 2 | 3; m: Manager }) {
  const ranks = {
    1: { h: "h-72 sm:h-96", accent: "from-gaffer-gold/80 via-[#FBE9A5]/40 to-gaffer-gold/0", chip: "bg-gaffer-gold text-gaffer-black", title: "CHAMPION", glow: "rgba(212,175,55,0.6)", icon: <Crown /> },
    2: { h: "h-64 sm:h-80",  accent: "from-[#E5E5E5]/60 via-white/20 to-white/0",            chip: "bg-[#E5E5E5] text-gaffer-black", title: "RUNNER-UP", glow: "rgba(229,229,229,0.5)", icon: <Star /> },
    3: { h: "h-60 sm:h-72",  accent: "from-[#E0A668]/60 via-[#E0A668]/20 to-transparent",    chip: "bg-[#E0A668] text-gaffer-black", title: "3RD",       glow: "rgba(224,166,104,0.5)", icon: <Star /> },
  }[place];

  return (
    <div className={`relative ${ranks.h} rounded-[2rem] p-1.5 bg-gradient-to-b ${ranks.accent} ${place === 1 ? "animate-hot-edge" : ""}`}>
      <div className="relative h-full rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 backdrop-blur-sm hairline inner-glow p-6 flex flex-col items-center justify-between overflow-hidden">
        {/* glow halo */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-2/3 h-2/3 rounded-full blur-3xl opacity-40" style={{ background: ranks.glow }} />
        </div>

        {/* rank chip */}
        <div className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${ranks.chip} font-mono text-[10px] font-bold tracking-[0.22em]`}>
          {ranks.icon}
          {ranks.title}
        </div>

        {/* centerpiece — giant rank number */}
        <div className="relative flex-1 flex items-center justify-center">
          <div
            className="font-display tabular-nums leading-none"
            style={{
              fontSize: place === 1 ? "11rem" : "8rem",
              color: ranks.glow,
              opacity: 0.18,
              textShadow: `0 0 60px ${ranks.glow}`,
            }}
          >
            {place}
          </div>
        </div>

        {/* bottom info */}
        <div className="relative text-center">
          <div className={`font-mono text-xl sm:text-2xl tracking-wide leading-none ${
            place === 1 ? "text-gaffer-gold" : place === 2 ? "text-white" : "text-[#E0A668]"
          }`}>
            <HoverWord glow={place === 1 ? "gold" : "white"}>{`${m.address.slice(0, 6)}…${m.address.slice(-4)}`}</HoverWord>
          </div>
          <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase mt-2">
            {m.w}W · {m.l}L · {m.win_rate}%
          </div>
          {m.isYou && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-gaffer-electric/15 px-2 py-0.5">
              <span className="h-1 w-1 rounded-full bg-gaffer-electric animate-live-dot" />
              <span className="font-mono text-[9px] tracking-[0.22em] text-gaffer-electric uppercase">YOU</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Crown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 18h18l-1.5-9-4.5 4-3-6-3 6-4.5-4L3 18z" />
    </svg>
  );
}
function Star() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
    </svg>
  );
}
function Flame() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c0 5-4 5-4 10a4 4 0 008 0c0-2 1-3 2-4 0 4-1 9-6 12-5-3-6-8-6-12 0-4 6-6 6-6z" />
    </svg>
  );
}
function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
