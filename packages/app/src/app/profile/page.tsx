"use client";

import { useMemo, useState, useEffect } from "react";
import { useGaffer, useManagerRecord, useHasMinted, useSquadCards, usePlayerTokens } from "@/lib/useGaffer";
import { useAllWars } from "@/lib/onchain";
import { fromUSDC } from "@/lib/usdcSolana";
import {
  getStarterIds,
  readPoints,
  readUpgrades,
  syncPointsFromRecord,
  upgradePlayer,
  effectiveRating,
  UPGRADE_COST,
  MAX_UPGRADES,
} from "@/lib/userRoster";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import type { ChainCard } from "@/lib/gafferPrograms";
import playersData from "@/data/players.json";
import { Player } from "@/types";

const players = playersData as Player[];
const pick = (id: string) => players.find((p) => p.id === id) ?? { id: "?", name: "Unknown", shortName: "?", nation: "?", nationCode: "?", position: "MID" as const, rating: 70, pace: 70, shooting: 70, passing: 70, defending: 70, physical: 70 };

// The Solana "empty"/default pubkey — used as the war winner when a war is a draw.
const ZERO_PUBKEY = "11111111111111111111111111111111";
const RARITY_NAMES = ["BRONZE", "SILVER", "GOLD", "ICON"] as const;
type RarityName = typeof RARITY_NAMES[number];

// Achievements are computed dynamically inside the component from chain reads.

function truncate(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ProfilePage() {
  const { address, pubkey, isConnected } = useGaffer();
  const me = address;

  const { data: record } = useManagerRecord(pubkey);
  const { data: hasMinted } = useHasMinted(pubkey);

  // ─── Squad cards (null = not minted) ─────────────────────────────────────
  const { data: squadCards } = useSquadCards(pubkey);
  const cards: ChainCard[] = useMemo(() => squadCards ?? [], [squadCards]);

  // ─── Scan resolved wars (same pattern as /wars) ──────────────────────────
  const { wars: allWars } = useAllWars();
  const myWars = useMemo(() => {
    if (!me) return [];
    return allWars
      .filter((w) => w.status === 2 && (w.challenger === me || w.opponent === me))
      .sort((a, b) => Number(b.id - a.id));
  }, [allWars, me]);

  // ─── Aggregates ──────────────────────────────────────────────────────────
  const winsN = Number(record?.wins ?? 0);
  const lossN = Number(record?.losses ?? 0);
  const total = winsN + lossN;
  const winRate = total === 0 ? 0 : Math.round((winsN / total) * 100);

  // ─── Points wallet — synced from W/L ─────────────────────────────────────
  const addressLower = address ?? "";
  const [points, setPoints] = useState(0);
  const [upgrades, setUpgrades] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!addressLower) return;
    setPoints(syncPointsFromRecord(addressLower, winsN, lossN));
    setUpgrades(readUpgrades(addressLower));
  }, [addressLower, winsN, lossN]);

  function doUpgrade(playerId: string) {
    if (!addressLower) return;
    const r = upgradePlayer(addressLower, playerId);
    if (!r.ok) return;
    setPoints(r.points ?? readPoints(addressLower));
    setUpgrades(readUpgrades(addressLower));
  }

  // ─── Owned roster (starter pack + minted via PlayerMint) ──────────────────
  const [starterIdsState, setStarterIdsState] = useState<string[]>([]);
  useEffect(() => {
    if (!addressLower) return;
    setStarterIdsState(getStarterIds(addressLower));
  }, [addressLower]);
  const { data: playerTokens } = usePlayerTokens(pubkey);
  const mintedIds = useMemo(() => {
    if (!playerTokens) return [];
    return playerTokens.map((t) => t.playerId).filter((id): id is string => !!id);
  }, [playerTokens]);
  const ownedRoster = useMemo(() => {
    const set = new Set<string>([...starterIdsState, ...mintedIds]);
    return Array.from(set)
      .map((id) => players.find((p) => p.id === id))
      .filter((p) => !!p)
      .map((p) => p!);
  }, [starterIdsState, mintedIds]);

  // Compute net USDC profit across resolved wars
  const profitUSDC = useMemo(() => {
    return myWars.reduce((acc, w) => {
      const stake = Number(fromUSDC(w.stake));
      const youWon = w.winner === me;
      const isDraw = w.winner === ZERO_PUBKEY;
      if (isDraw) return acc; // no net profit on draws
      return acc + (youWon ? stake * 2 * 0.95 - stake : -stake);
    }, 0);
  }, [myWars, me]);
  const totalProfit = `${profitUSDC >= 0 ? "+" : ""}${profitUSDC.toFixed(4)}`;

  // Total fantasy points across squad
  const totalPts = cards.reduce((a, c) => a + Number(c.tournamentPts), 0);

  // Compute achievement unlocks dynamically
  const achievements = [
    { id: "first-mint",  label: "First Five",       desc: "Minted your first squad",  glyph: "★", unlocked: !!hasMinted },
    { id: "first-war",   label: "Opening Whistle",  desc: "Resolved your first war",  glyph: "⚔", unlocked: winsN + lossN > 0 },
    { id: "first-win",   label: "First Blood",      desc: "Win a war",                glyph: "♦", unlocked: winsN > 0 },
    { id: "first-icon",  label: "Forge Master",     desc: "Upgrade a card to Icon",   glyph: "⬡", unlocked: cards.some((c) => c.rarity === 3) },
    { id: "five-wins",   label: "Five-In-A-Row",    desc: "Win 5 wars total",         glyph: "▲", unlocked: winsN >= 5 },
    { id: "lift-cup",    label: "Lift the Cup",     desc: "Win the tournament",       glyph: "♛", unlocked: false },
  ];

  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        <Backdrop src={FOOTBALL_IMAGERY.goldenHour} opacity={0.25} blur={3} overlay="hero" blend="luminosity" scale={1.05} />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />

        <div className="relative mx-auto max-w-7xl">
          {/* HEADER — manager identity */}
          <section className="flex flex-wrap items-end justify-between gap-6 mb-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] hairline px-3 py-1 hover-lift">
                <span className="font-mono text-[10px] tracking-[0.22em] text-white/70 uppercase">
                  The Gaffer
                </span>
              </div>
              <h1 className="mt-5 font-display text-white text-6xl sm:text-8xl leading-[0.85]">
                <LetterWave text="Your" glow="white" charDelay={28} liftPx={10} /><br/>
                <span className="text-gaffer-gold">
                  <LetterWave text="legacy." glow="gold" charDelay={30} liftPx={12} />
                </span>
              </h1>
              <div className="mt-4 flex items-center gap-3">
                <span className="font-mono text-sm tracking-[0.15em] text-white/70 uppercase">
                  Manager · {truncate(address)}
                </span>
                {isConnected && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gaffer-electric/15 px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-gaffer-electric animate-live-dot" />
                    <span className="font-mono text-[10px] tracking-[0.22em] text-gaffer-electric uppercase">Connected</span>
                  </span>
                )}
              </div>
            </div>

            {/* Stat strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label="Wins"     value={winsN}   tone="electric" />
              <StatTile label="Losses"   value={lossN}   tone="red" />
              <StatTile label="Win rate" value={`${winRate}%`} tone="gold" />
              <StatTile label="Profit"   value={totalProfit} unit="USDC" tone={profitUSDC >= 0 ? "electric" : "red"} />
            </div>
          </section>

          {!isConnected ? (
            <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
              <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-12 text-center">
                <h2 className="font-display text-white text-4xl sm:text-5xl">Connect to view your gaffer.</h2>
                <p className="mt-2 text-white/55">Your squad, your history, your unlocks — all on-chain.</p>
                <div className="mt-6 inline-block">
                  <ConnectButton />
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* MY SQUAD — real on-chain cards */}
              <section className="mt-4">
                <SectionHead
                  eyebrow={hasMinted ? "The Five · On-chain" : "The Five"}
                  title={<>Your <span className="text-gaffer-gold">squad.</span></>}
                  right={<div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Total points · <span className="text-gaffer-gold">{totalPts}</span></div>}
                />
                {!hasMinted ? (
                  <div className="mt-8 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
                    <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow p-10 text-center">
                      <div className="font-display text-3xl text-white">No squad minted yet.</div>
                      <p className="mt-2 text-white/55">Draft five real World Cup players to start.</p>
                      <Link href="/squad"
                        className="mt-5 inline-flex items-center gap-2 rounded-full bg-gaffer-gold pl-5 pr-2 py-2 text-gaffer-black transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light">
                        <span className="font-display text-base tracking-wider">BUILD YOUR FIVE</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gaffer-black/15"><Arrow /></span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 justify-items-center">
                    {cards.map((c, i) => (
                      <div key={c.playerId + i} className="reveal flex flex-col items-center gap-3" style={{ ["--stagger-delay" as any]: `${i * 80}ms` }}>
                        <PlayerCard player={pick(c.playerId)} rarity={RARITY_NAMES[c.rarity] as RarityName} size="md" />
                        <div className="text-center">
                          <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">Pts · <span className="text-gaffer-gold">{c.tournamentPts}</span></div>
                          <div className="font-mono text-[10px] tracking-[0.15em] text-white/30 uppercase mt-0.5">
                            {c.goals}G · {c.assists}A · {c.cleanSheets}CS
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* While loading: show placeholders */}
                    {cards.length === 0 && hasMinted && squadCards === undefined && Array.from({ length: 5 }).map((_, i) => (
                      <div key={`skel-${i}`} className="w-44 h-60 rounded-xl bg-white/[0.04] animate-pulse" />
                    ))}
                  </div>
                )}
              </section>

              {/* MANAGER POINTS — earned per result, spent on player upgrades */}
              <section className="mt-20">
                <SectionHead
                  eyebrow="Manager points"
                  title={<>Upgrade your <span className="text-gaffer-electric">five.</span></>}
                  right={
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Balance</div>
                        <div className="font-display text-3xl text-gaffer-electric tabular-nums leading-none" style={{ textShadow: "0 0 18px rgba(34, 197, 141,0.35)" }}>
                          {points}
                        </div>
                      </div>
                      <div className="font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase max-w-[14ch] leading-relaxed text-right hidden sm:block">
                        +50 per win<br/>+15 draw<br/>+5 loss
                      </div>
                    </div>
                  }
                />

                {ownedRoster.length === 0 ? (
                  <div className="mt-8 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
                    <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow p-10 text-center">
                      <div className="font-display text-2xl text-white">No players yet — head to Manager HQ to open your starter pack.</div>
                      <Link href="/play?pack=open" className="mt-4 inline-flex items-center gap-2 rounded-full bg-gaffer-electric pl-5 pr-2 py-2 text-gaffer-black hover:brightness-110 transition-transform duration-150 ease-out-strong active:scale-[0.97]">
                        <span className="font-display text-sm tracking-wider">OPEN PACK</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gaffer-black/15"><Arrow /></span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {ownedRoster.map((p, i) => {
                      const lv = upgrades[p.id] ?? 0;
                      const eff = effectiveRating(p, upgrades);
                      const canAfford = points >= UPGRADE_COST;
                      const maxed = lv >= MAX_UPGRADES;
                      return (
                        <div
                          key={p.id}
                          className="reveal rounded-2xl p-[1.5px] bg-gradient-to-br from-gaffer-electric/30 via-white/5 to-transparent hover-lift"
                          style={{ ["--stagger-delay" as any]: `${i * 60}ms` }}
                        >
                          <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow p-4 flex items-center gap-4">
                            <img
                              src={`/players/${p.id}.png`}
                              alt=""
                              className="h-14 w-14 rounded-full object-cover bg-gaffer-pitch ring-1 ring-gaffer-gold/30"
                              draggable={false}
                              onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-display text-lg text-white leading-none">{p.shortName}</div>
                              <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase mt-1">
                                {p.position} · <span className="text-gaffer-gold">{p.nation}</span>
                              </div>
                              <div className="mt-2 flex items-center gap-2 font-mono text-[11px]">
                                <span className="tabular-nums text-white/55">{p.rating}</span>
                                <span className="text-gaffer-electric">→</span>
                                <span className="font-display text-xl tabular-nums text-gaffer-electric leading-none">{eff}</span>
                                {lv > 0 && (
                                  <span className="rounded-full bg-gaffer-electric/15 px-1.5 py-0.5 text-[9px] tracking-[0.22em] uppercase text-gaffer-electric">
                                    +{lv}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => doUpgrade(p.id)}
                              disabled={!canAfford || maxed}
                              className={`shrink-0 rounded-full px-4 py-2 font-display text-sm tracking-wider transition-transform duration-150 ease-out-strong active:scale-95 ${
                                maxed
                                  ? "bg-gaffer-gold/20 text-gaffer-gold/60 cursor-default"
                                  : canAfford
                                    ? "bg-gaffer-electric text-gaffer-black hover:brightness-110"
                                    : "bg-white/5 text-white/30 cursor-not-allowed"
                              }`}
                              title={maxed ? "Max level" : canAfford ? `Spend ${UPGRADE_COST} pts` : `Need ${UPGRADE_COST} pts`}
                            >
                              {maxed ? "MAX" : `+1 · ${UPGRADE_COST}p`}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* RECENT WARS — real on-chain history */}
              <section className="mt-20">
                <SectionHead
                  eyebrow={myWars.length > 0 ? `Match log · ${myWars.length}` : "Match log"}
                  title={<>Recent <span className="text-gaffer-electric">wars.</span></>}
                  right={<Link href="/wars" className="font-mono text-[12px] tracking-[0.2em] uppercase text-white/60 hover:text-gaffer-gold transition-colors">Find new →</Link>}
                />
                {myWars.length === 0 ? (
                  <div className="mt-8 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
                    <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow p-10 text-center">
                      <div className="font-display text-3xl text-white">No wars resolved yet.</div>
                      <p className="mt-2 text-white/55">Accept a challenge and your history will show here.</p>
                    </div>
                  </div>
                ) : (
                <div className="mt-8 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
                  <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow overflow-hidden">
                    {myWars.map((w, i) => {
                      const youAreChallenger = w.challenger === me;
                      const youWon = w.winner === me;
                      const isDraw = w.winner === ZERO_PUBKEY;
                      const opp = youAreChallenger ? w.opponent : w.challenger;
                      const yourScore = youAreChallenger ? w.challengerScore : w.opponentScore;
                      const theirScore = youAreChallenger ? w.opponentScore : w.challengerScore;
                      const stake = Number(fromUSDC(w.stake));
                      const profit = isDraw ? 0 : youWon ? stake * 2 * 0.95 - stake : -stake;
                      const profitStr = `${profit >= 0 ? "+" : ""}${profit.toFixed(4)}`;
                      const resultLetter: "W" | "L" | "D" = isDraw ? "D" : youWon ? "W" : "L";
                      const win = resultLetter === "W";
                      return (
                        <Link
                          key={String(w.id)}
                          href={`/war/${w.id}`}
                          className={`grid grid-cols-12 gap-4 items-center px-6 py-5 hover:bg-white/[0.03] transition-colors duration-150 ${i < myWars.length - 1 ? "border-b border-white/5" : ""}`}
                        >
                          <div className="col-span-1">
                            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-full font-display text-lg ${
                              win ? "bg-gaffer-electric/15 text-gaffer-electric ring-1 ring-gaffer-electric/40"
                                  : "bg-gaffer-red/15 text-gaffer-red ring-1 ring-gaffer-red/40"
                            }`}>{resultLetter}</div>
                          </div>
                          <div className="col-span-4">
                            <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase">War #{String(w.id)} · MD{String(w.matchday)}</div>
                            <div className="font-semibold text-white">
                              <HoverWord glow="white">{`${opp.slice(0, 6)}…${opp.slice(-4)}`}</HoverWord>
                            </div>
                          </div>
                          <div className="col-span-3 text-center">
                            <div className="font-display text-2xl text-white tabular-nums leading-none">
                              {String(yourScore)}–{String(theirScore)}
                            </div>
                            <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase mt-1">final</div>
                          </div>
                          <div className="col-span-3 text-right">
                            <div className={`font-display text-2xl tabular-nums leading-none ${
                              profit > 0 ? "text-gaffer-electric" : profit < 0 ? "text-gaffer-red" : "text-white/70"
                            }`}>{profitStr}</div>
                            <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase mt-1">USDC</div>
                          </div>
                          <div className="col-span-1 text-right text-white/30">
                            <Arrow />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
                )}
              </section>

              {/* ACHIEVEMENTS + cross-links */}
              <RelatedLinks current="/profile" />

              <section className="mt-20">
                <SectionHead
                  eyebrow="Trophy case"
                  title={<>Your <span className="text-gaffer-gold">unlocks.</span></>}
                  right={
                    <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
                      <span className="text-gaffer-gold">{achievements.filter(a => a.unlocked).length}</span>
                      <span className="mx-1">/</span>
                      {achievements.length} unlocked
                    </div>
                  }
                />
                <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {achievements.map((a, i) => (
                    <div
                      key={a.id}
                      className={`reveal rounded-2xl p-[1.5px] hover-lift transition-opacity duration-200 ${
                        a.unlocked ? "bg-gradient-to-br from-gaffer-gold/40 to-gaffer-gold/0" : "bg-white/[0.04] hairline-strong opacity-60"
                      }`}
                      style={{ ["--stagger-delay" as any]: `${i * 70}ms` }}
                    >
                      <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow p-5 text-center h-full">
                        <div className={`font-display text-5xl ${a.unlocked ? "text-gaffer-gold" : "text-white/15"}`}
                          style={a.unlocked ? { textShadow: "0 0 20px rgba(212,175,55,0.4)" } : undefined}>
                          {a.glyph}
                        </div>
                        <div className={`mt-2 font-display text-base ${a.unlocked ? "text-white" : "text-white/40"}`}>
                          {a.label}
                        </div>
                        <div className="mt-1 font-mono text-[9px] tracking-[0.18em] text-white/35 uppercase leading-relaxed">
                          {a.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function SectionHead({ eyebrow, title, right }: { eyebrow: string; title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-4">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] hairline px-3 py-1 font-mono text-[10px] tracking-[0.22em] text-white/70 uppercase hover-lift">
          {eyebrow}
        </div>
        <h2 className="mt-4 font-display text-white text-5xl sm:text-6xl leading-[0.9]">{title}</h2>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

function StatTile({ label, value, unit, tone }: { label: string; value: string | number; unit?: string; tone: "gold" | "electric" | "white" | "red" }) {
  const accent = { gold: "text-gaffer-gold", electric: "text-gaffer-electric", white: "text-white", red: "text-gaffer-red" }[tone];
  return (
    <div className="rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong hover-lift">
      <div className="rounded-[15px] bg-gaffer-surface/70 hairline inner-glow px-4 py-3">
        <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">{label}</div>
        <div className={`font-display text-3xl ${accent} tabular-nums leading-none mt-1`}>
          {value}
          {unit && <span className="font-mono text-[10px] tracking-[0.18em] text-white/40 ml-1">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
