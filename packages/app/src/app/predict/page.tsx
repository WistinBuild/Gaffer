"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import {
  readBankroll,
  readBets,
  placeBet,
  payoutFor,
  resetBankroll,
  STARTING_BANKROLL,
  type DemoBet,
} from "@/lib/predictBets";
import { playClick, playCoin, playFail, playSuccess, unlockAudio } from "@/lib/sounds";

// ─── Mock market data ─────────────────────────────────────────────────────────
const TOURNAMENT_OPENS = new Date("2026-06-11T20:00:00Z"); // World Cup 2026 opening match

interface Outright {
  id: string;
  category: string;
  question: string;
  options: { label: string; pct: number; flag?: string }[];
  volume: string;
}

const OUTRIGHTS: Outright[] = [
  {
    id: "winner",
    category: "WORLD CUP 2026",
    question: "Who lifts the trophy?",
    volume: "412 ETH",
    options: [
      { label: "Argentina",   pct: 18, flag: "🇦🇷" },
      { label: "Brazil",      pct: 16, flag: "🇧🇷" },
      { label: "France",      pct: 14, flag: "🇫🇷" },
      { label: "England",     pct: 12, flag: "🏴" },
      { label: "Spain",       pct: 11, flag: "🇪🇸" },
      { label: "Germany",     pct: 8,  flag: "🇩🇪" },
      { label: "Portugal",    pct: 7,  flag: "🇵🇹" },
      { label: "Field (Any other)",  pct: 14 },
    ],
  },
  {
    id: "topscorer",
    category: "GOLDEN BOOT",
    question: "Top scorer of the tournament?",
    volume: "188 ETH",
    options: [
      { label: "Kylian Mbappé",       pct: 22, flag: "🇫🇷" },
      { label: "Vinícius Jr.",        pct: 14, flag: "🇧🇷" },
      { label: "Harry Kane",          pct: 12, flag: "🏴" },
      { label: "Jude Bellingham",     pct: 9,  flag: "🏴" },
      { label: "Lautaro Martínez",    pct: 8,  flag: "🇦🇷" },
      { label: "Field",                pct: 35 },
    ],
  },
  {
    id: "goldenball",
    category: "GOLDEN BALL",
    question: "Player of the tournament?",
    volume: "127 ETH",
    options: [
      { label: "Mbappé",     pct: 19, flag: "🇫🇷" },
      { label: "Bellingham", pct: 14, flag: "🏴" },
      { label: "Vinícius Jr.", pct: 12, flag: "🇧🇷" },
      { label: "Rodri",      pct: 9,  flag: "🇪🇸" },
      { label: "Messi",      pct: 7,  flag: "🇦🇷" },
      { label: "Field",      pct: 39 },
    ],
  },
  {
    id: "darkhorse",
    category: "DARK HORSE",
    question: "Will any unseeded team reach the SF?",
    volume: "62 ETH",
    options: [
      { label: "Yes",  pct: 33 },
      { label: "No",   pct: 67 },
    ],
  },
];

interface GroupMatch {
  matchday: number;
  group: string;
  home: { name: string; flag: string; odds: number };
  away: { name: string; flag: string; odds: number };
  draw: number;
  date: string;
  status: "upcoming" | "live" | "settled";
}

const GROUP_MATCHES: GroupMatch[] = [
  { matchday: 1, group: "A", home: { name: "Mexico",      flag: "🇲🇽", odds: 38 }, away: { name: "Saudi Arabia",  flag: "🇸🇦", odds: 34 }, draw: 28, date: "Jun 11", status: "upcoming" },
  { matchday: 1, group: "B", home: { name: "Canada",      flag: "🇨🇦", odds: 41 }, away: { name: "Iceland",       flag: "🇮🇸", odds: 32 }, draw: 27, date: "Jun 12", status: "upcoming" },
  { matchday: 1, group: "C", home: { name: "USA",         flag: "🇺🇸", odds: 47 }, away: { name: "Australia",     flag: "🇦🇺", odds: 27 }, draw: 26, date: "Jun 12", status: "upcoming" },
  { matchday: 1, group: "D", home: { name: "Argentina",   flag: "🇦🇷", odds: 62 }, away: { name: "Egypt",         flag: "🇪🇬", odds: 18 }, draw: 20, date: "Jun 13", status: "upcoming" },
  { matchday: 1, group: "E", home: { name: "France",      flag: "🇫🇷", odds: 58 }, away: { name: "Japan",         flag: "🇯🇵", odds: 22 }, draw: 20, date: "Jun 13", status: "upcoming" },
  { matchday: 1, group: "F", home: { name: "Brazil",      flag: "🇧🇷", odds: 64 }, away: { name: "Senegal",       flag: "🇸🇳", odds: 18 }, draw: 18, date: "Jun 14", status: "upcoming" },
  { matchday: 1, group: "G", home: { name: "England",     flag: "🏴", odds: 55 }, away: { name: "South Korea",   flag: "🇰🇷", odds: 23 }, draw: 22, date: "Jun 14", status: "upcoming" },
  { matchday: 1, group: "H", home: { name: "Spain",       flag: "🇪🇸", odds: 60 }, away: { name: "Morocco",       flag: "🇲🇦", odds: 20 }, draw: 20, date: "Jun 15", status: "upcoming" },
];

const NOVELTY = [
  { question: "First red card of the tournament?",     yes: 78, sub: "Within first 5 matches" },
  { question: "Hat-trick scored in the group stage?",  yes: 64, sub: "Any player, any match" },
  { question: "Match decided on penalties in KO?",     yes: 71, sub: "Round of 16 or later" },
  { question: "VAR overturns a goal in the Final?",    yes: 28, sub: "Final match only" },
];

// ─── Live countdown hook ─────────────────────────────────────────────────────
function useCountdown(target: Date) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return { d: 0, h: 0, m: 0, s: 0, ready: false };
  const diff = Math.max(0, target.getTime() - now.getTime());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, ready: true };
}

// ─── PAGE ────────────────────────────────────────────────────────────────────
export default function PredictPage() {
  const c = useCountdown(TOURNAMENT_OPENS);
  const { address } = useAccount();
  const addressLower = address?.toLowerCase() ?? "";

  // ─── Demo bankroll + bets (localStorage) ─────────────────────────────
  const [bankroll, setBankroll] = useState(STARTING_BANKROLL);
  const [bets, setBets] = useState<DemoBet[]>([]);
  useEffect(() => {
    setBankroll(readBankroll(addressLower));
    setBets(readBets(addressLower));
  }, [addressLower]);

  // ─── Bet modal state ─────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCtx, setModalCtx] = useState<{
    marketId: string;
    marketName: string;
    optionLabel: string;
    oddsPct: number;
  } | null>(null);

  function openBetModal(ctx: {
    marketId: string;
    marketName: string;
    optionLabel: string;
    oddsPct: number;
  }) {
    unlockAudio().catch(() => {});
    playClick();
    setModalCtx(ctx);
    setModalOpen(true);
  }

  function handlePlace(stake: number) {
    if (!modalCtx) return;
    const r = placeBet(addressLower, {
      marketId:    modalCtx.marketId,
      marketName:  modalCtx.marketName,
      optionLabel: modalCtx.optionLabel,
      stake,
      oddsPct:     modalCtx.oddsPct,
    });
    if (!r.ok) { playFail(); return; }
    playCoin();
    setBankroll(r.bankroll!);
    setBets(readBets(addressLower));
    setModalOpen(false);
  }

  function handleReset() {
    if (!confirm("Reset demo bankroll to 100 ETH and clear all bets?")) return;
    resetBankroll(addressLower);
    setBankroll(STARTING_BANKROLL);
    setBets([]);
    playSuccess();
  }

  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        <Backdrop src={FOOTBALL_IMAGERY.trophy} opacity={0.22} blur={3} overlay="hero" blend="luminosity" scale={1.05} />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-25" />

        <div className="relative mx-auto max-w-7xl">
          {/* ─── HEADER ──────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gaffer-electric/15 hairline px-3 py-1 hover-lift">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gaffer-electric animate-live-dot" />
                <span className="font-mono text-[10px] tracking-[0.22em] text-gaffer-electric uppercase">
                  Testnet · Demo bets open
                </span>
              </div>
              <h1 className="mt-5 font-display text-white text-7xl sm:text-9xl leading-[0.85]">
                <LetterWave text="Predict" glow="white" charDelay={28} liftPx={12} /><br/>
                <span className="text-gaffer-gold">
                  <LetterWave text="the cup." glow="gold" charDelay={30} liftPx={14} />
                </span>
              </h1>
              <p className="mt-4 text-white/55 max-w-xl">
                Demo bets are live now — place a stake on any market with your testnet bankroll.
                Real on-chain settlement opens at WC kickoff, scored by the same Oracle that
                resolves Squad Wars.
              </p>
            </div>

            {/* Bankroll + countdown stacked */}
            <div className="flex flex-col items-end gap-3">
              <BankrollPanel bankroll={bankroll} onReset={handleReset} />
              <CountdownPanel c={c} />
            </div>
          </div>

          {/* ─── DEMO-MODE STRIP ──────────────────────────────────────── */}
          <div className="rounded-2xl p-[1.5px] bg-gradient-to-r from-gaffer-electric/40 via-white/10 to-gaffer-gold/30 mb-14">
            <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/80 backdrop-blur-sm hairline inner-glow px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <SparkIcon />
                <div>
                  <div className="font-display text-lg text-white leading-none">Testnet demo · play before kickoff.</div>
                  <div className="font-mono text-[10px] tracking-[0.22em] text-white/55 uppercase mt-1">
                    100 ETH starting bankroll · all bets settle on-chain once WC 2026 begins
                  </div>
                </div>
              </div>
              <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-electric uppercase">
                ● {bets.length} active demo bet{bets.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {/* ─── MY BETS (only when bets exist) ─────────────────────── */}
          {bets.length > 0 && (
            <section className="mb-14">
              <SectionHead
                eyebrow={<><span className="text-gaffer-electric">●</span> YOUR DEMO BETS · {bets.length}</>}
                title={<>Open <span className="text-gaffer-electric">positions.</span></>}
                right={<div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Settle at kickoff</div>}
              />
              <div className="mt-6 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
                <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow overflow-hidden">
                  {bets.map((b, i) => (
                    <MyBetRow key={b.id} bet={b} isLast={i === bets.length - 1} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ─── FEATURED OUTRIGHTS ─────────────────────────────────── */}
          <section>
            <SectionHead
              eyebrow={<><span className="text-gaffer-gold">★</span> TOURNAMENT OUTRIGHTS</>}
              title={<>Long bets, <span className="text-gaffer-gold">big swings.</span></>}
              right={<div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Settled after the Final</div>}
            />
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              {OUTRIGHTS.map((m, i) => (
                <div key={m.id} className="reveal" style={{ ["--stagger-delay" as any]: `${i * 80}ms` }}>
                  <OutrightCard market={m} onPick={(opt) => openBetModal({ marketId: m.id, marketName: m.question, optionLabel: opt.label, oddsPct: opt.pct })} />
                </div>
              ))}
            </div>
          </section>

          {/* ─── GROUP MATCH MARKETS ────────────────────────────────── */}
          <section className="mt-20">
            <SectionHead
              eyebrow={<>MATCHDAY 1 · GROUP STAGE</>}
              title={<>Bet the <span className="text-gaffer-electric">opening 8.</span></>}
              right={<div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Settled same day</div>}
            />
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3">
              {GROUP_MATCHES.map((m, i) => (
                <div key={`${m.group}-${m.home.name}`} className="reveal" style={{ ["--stagger-delay" as any]: `${i * 50}ms` }}>
                  <MatchCard match={m} onPickHome={() => openBetModal({ marketId: `md1-${m.group}-home`, marketName: `${m.home.name} vs ${m.away.name}`, optionLabel: m.home.name, oddsPct: m.home.odds })} onPickDraw={() => openBetModal({ marketId: `md1-${m.group}-draw`, marketName: `${m.home.name} vs ${m.away.name}`, optionLabel: "Draw", oddsPct: m.draw })} onPickAway={() => openBetModal({ marketId: `md1-${m.group}-away`, marketName: `${m.home.name} vs ${m.away.name}`, optionLabel: m.away.name, oddsPct: m.away.odds })} />
                </div>
              ))}
            </div>
          </section>

          {/* ─── NOVELTY MARKETS ────────────────────────────────────── */}
          <section className="mt-20">
            <SectionHead
              eyebrow={<>NOVELTY</>}
              title={<>For <span className="text-gaffer-gold">degenerates.</span></>}
              right={<div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Niche · binary YES/NO</div>}
            />
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3">
              {NOVELTY.map((n, i) => (
                <div key={i} className="reveal" style={{ ["--stagger-delay" as any]: `${i * 60}ms` }}>
                  <NoveltyCard {...n} onYes={() => openBetModal({ marketId: `nov-${i}`, marketName: n.question, optionLabel: "YES", oddsPct: n.yes })} onNo={() => openBetModal({ marketId: `nov-${i}`, marketName: n.question, optionLabel: "NO", oddsPct: 100 - n.yes })} />
                </div>
              ))}
            </div>
          </section>

          {/* ─── INFO STRIP ─────────────────────────────────────────── */}
          <section className="mt-24">
            <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
              <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-6 sm:p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                <InfoTile label="Settlement" value="Oracle-based" sub="Same matchday data used by Squad Wars" />
                <InfoTile label="Fee" value="2% on profit" sub="Only winners pay · taken from PnL" />
                <InfoTile label="Markets" value="120+" sub="Outrights · matches · novelty" />
              </div>
            </div>
          </section>

          {/* ─── CTA ────────────────────────────────────────────────── */}
          <section className="mt-20 text-center">
            <p className="text-white/55 mb-4 font-mono text-[11px] tracking-[0.22em] uppercase">While you wait</p>
            <Link
              href="/squad"
              className="group inline-flex items-center gap-3 rounded-full bg-gaffer-gold pl-8 pr-2.5 py-3.5 text-gaffer-black
                transition-transform duration-150 ease-out-strong active:scale-[0.96] hover:bg-gaffer-gold-light animate-hot-edge"
            >
              <span className="font-display text-xl tracking-wider">DRAFT YOUR SQUAD</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gaffer-black/15 transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5">
                <Arrow />
              </span>
            </Link>
          </section>

          <RelatedLinks current="/predict" />
        </div>

        {modalOpen && modalCtx && (
          <BetModal
            ctx={modalCtx}
            bankroll={bankroll}
            onClose={() => setModalOpen(false)}
            onPlace={handlePlace}
          />
        )}
      </main>
    </>
  );
}

// ─── PIECES ─────────────────────────────────────────────────────────────────

function CountdownPanel({ c }: { c: { d: number; h: number; m: number; s: number; ready: boolean } }) {
  return (
    <div className="rounded-2xl p-[1.5px] bg-gradient-to-br from-gaffer-gold/40 to-gaffer-gold/0">
      <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-black/60 backdrop-blur-sm hairline inner-glow px-5 py-3">
        <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase mb-2 text-center">
          Markets unlock in
        </div>
        <div className="flex items-baseline gap-4 font-mono tabular-nums">
          <TimeChip label="DAYS" value={c.d} />
          <Sep />
          <TimeChip label="HRS"  value={c.h} />
          <Sep />
          <TimeChip label="MIN"  value={c.m} />
          <Sep />
          <TimeChip label="SEC"  value={c.s} flicker />
        </div>
      </div>
    </div>
  );
}

function TimeChip({ label, value, flicker }: { label: string; value: number; flicker?: boolean }) {
  return (
    <div className="text-center">
      <div className={`font-display text-4xl text-gaffer-gold tabular-nums leading-none ${flicker ? "animate-scoreboard" : ""}`}
        style={{ textShadow: "0 0 16px rgba(212,175,55,0.4)" }}>
        {String(value).padStart(2, "0")}
      </div>
      <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase mt-1">{label}</div>
    </div>
  );
}

function Sep() {
  return <span className="font-display text-3xl text-white/20 leading-none">:</span>;
}

function OutrightCard({ market, onPick }: { market: Outright; onPick: (o: Outright["options"][number]) => void }) {
  const top = [...market.options].sort((a, b) => b.pct - a.pct)[0];

  return (
    <div className="group relative rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong hover-lift overflow-hidden">
      <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow p-6 relative">
        {/* Head */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-gold/80 uppercase">{market.category}</div>
            <div className="mt-2 font-display text-2xl text-white leading-tight">
              <HoverWord glow="gold">{market.question}</HoverWord>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">Volume</div>
            <div className="font-display text-lg text-gaffer-gold tabular-nums leading-none mt-1">{market.volume}</div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {market.options.map((o) => {
            const isLeader = o.label === top.label;
            return (
              <button
                key={o.label}
                onClick={() => onPick(o)}
                className={`group/opt relative w-full text-left rounded-lg px-3 py-2.5 overflow-hidden transition-all duration-200 active:scale-[0.99] cursor-pointer hover:ring-1 hover:ring-gaffer-electric/40
                  ${isLeader ? "bg-gaffer-gold/10" : "bg-white/[0.03]"}`}
              >
                {/* Progress fill */}
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-700 ease-out-strong"
                  style={{
                    width: `${o.pct}%`,
                    background: isLeader
                      ? "linear-gradient(to right, rgba(212,175,55,0.20), rgba(212,175,55,0.04))"
                      : "linear-gradient(to right, rgba(255,255,255,0.06), rgba(255,255,255,0.01))",
                  }}
                />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="text-sm text-white/90 flex items-center gap-2">
                    {o.flag && <span aria-hidden>{o.flag}</span>}
                    <HoverWord glow={isLeader ? "gold" : "white"}>{o.label}</HoverWord>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-gaffer-electric/0 group-hover/opt:text-gaffer-electric transition-colors duration-150">bet →</span>
                    <span className={`font-display text-lg tabular-nums tracking-tight ${isLeader ? "text-gaffer-gold" : "text-white/75"}`}>
                      {o.pct}%
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match: m, onPickHome, onPickDraw, onPickAway }: { match: GroupMatch; onPickHome: () => void; onPickDraw: () => void; onPickAway: () => void }) {
  return (
    <div className="group relative rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong hover-lift overflow-hidden">
      <div className="relative rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow px-5 py-4">
        {/* Top row — group + date */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[8px] tracking-[0.22em] text-white/40 uppercase">Grp</span>
            <span className="font-display text-2xl text-gaffer-gold leading-none">{m.group}</span>
          </div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-white/55 uppercase">{m.date}</div>
        </div>

        {/* Three pick buttons — Home / Draw / Away */}
        <div className="grid grid-cols-3 gap-2">
          <PickTile flag={m.home.flag} label={m.home.name} pct={m.home.odds} onClick={onPickHome} />
          <PickTile label="Draw" pct={m.draw} onClick={onPickDraw} muted />
          <PickTile flag={m.away.flag} label={m.away.name} pct={m.away.odds} onClick={onPickAway} />
        </div>
      </div>
    </div>
  );
}

function PickTile({ flag, label, pct, onClick, muted }: { flag?: string; label: string; pct: number; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`group/p relative rounded-lg px-3 py-2.5 hairline overflow-hidden text-left transition-all duration-200 active:scale-[0.97] hover:ring-1 hover:ring-gaffer-electric/40 ${muted ? "bg-white/[0.025]" : "bg-white/[0.04]"}`}
    >
      <div className="absolute inset-y-0 left-0 transition-all duration-700 ease-out-strong"
        style={{
          width: `${pct}%`,
          background: muted ? "linear-gradient(to right, rgba(255,255,255,0.05), transparent)" : "linear-gradient(to right, rgba(0,255,135,0.15), rgba(0,255,135,0.02))",
        }} />
      <div className="relative">
        <div className="font-mono text-[8px] tracking-[0.22em] text-white/40 uppercase">{pct}%</div>
        <div className="font-display text-sm text-white leading-tight mt-0.5 truncate">
          {flag && <span aria-hidden className="mr-1">{flag}</span>}{label}
        </div>
        <div className="font-mono text-[8px] tracking-[0.22em] text-gaffer-electric/0 group-hover/p:text-gaffer-electric mt-0.5 transition-colors">bet →</div>
      </div>
    </button>
  );
}

function NoveltyCard({ question, yes, sub, onYes, onNo }: { question: string; yes: number; sub: string; onYes: () => void; onNo: () => void }) {
  const no = 100 - yes;
  return (
    <div className="group relative rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong hover-lift overflow-hidden">
      <div className="relative rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow p-5">
        <div>
          <div className="font-display text-xl text-white leading-tight">
            <HoverWord glow="gold">{question}</HoverWord>
          </div>
          <div className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase mt-1">{sub}</div>
        </div>

        {/* YES / NO bar */}
        <div className="mt-5 rounded-full h-2.5 overflow-hidden bg-white/[0.04] hairline flex">
          <div className="bg-gaffer-electric/60" style={{ width: `${yes}%`, boxShadow: "0 0 10px rgba(0,255,135,0.3)" }} />
          <div className="bg-gaffer-red/60" style={{ width: `${no}%` }} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onYes} className="group/y rounded-lg px-3 py-2 bg-gaffer-electric/10 hairline hover:bg-gaffer-electric/20 transition-colors active:scale-[0.98] text-left">
            <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
              <span className="flex items-center gap-1.5 text-gaffer-electric">
                <span className="h-1.5 w-1.5 rounded-full bg-gaffer-electric" />
                YES
              </span>
              <span className="text-white/85">{yes}%</span>
            </div>
            <div className="font-mono text-[8px] tracking-[0.22em] text-gaffer-electric/60 mt-1 uppercase">bet yes →</div>
          </button>
          <button onClick={onNo} className="group/n rounded-lg px-3 py-2 bg-gaffer-red/10 hairline hover:bg-gaffer-red/20 transition-colors active:scale-[0.98] text-left">
            <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
              <span className="flex items-center gap-1.5 text-gaffer-red">
                <span className="h-1.5 w-1.5 rounded-full bg-gaffer-red" />
                NO
              </span>
              <span className="text-white/85">{no}%</span>
            </div>
            <div className="font-mono text-[8px] tracking-[0.22em] text-gaffer-red/60 mt-1 uppercase">bet no →</div>
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="hover-lift cursor-default">
      <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">{label}</div>
      <div className="font-display text-3xl text-white leading-none mt-2">
        <HoverWord glow="gold">{value}</HoverWord>
      </div>
      <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 mt-2 leading-relaxed">{sub}</div>
    </div>
  );
}

function SectionHead({ eyebrow, title, right }: { eyebrow: React.ReactNode; title: React.ReactNode; right?: React.ReactNode }) {
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

function BankrollPanel({ bankroll, onReset }: { bankroll: number; onReset: () => void }) {
  return (
    <div className="rounded-2xl p-[1.5px] bg-gradient-to-br from-gaffer-electric/50 via-white/10 to-transparent">
      <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-black/70 backdrop-blur-sm hairline inner-glow px-5 py-3 flex items-center gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Demo bankroll</div>
          <div className="font-display text-4xl text-gaffer-electric tabular-nums leading-none mt-1" style={{ textShadow: "0 0 18px rgba(0,255,135,0.45)" }}>
            {bankroll.toFixed(1)}
            <span className="font-mono text-[10px] tracking-[0.18em] text-white/40 ml-1.5">ETH</span>
          </div>
        </div>
        <button
          onClick={onReset}
          aria-label="Reset bankroll"
          className="h-8 w-8 rounded-full bg-white/[0.06] hairline flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.12] transition-colors active:scale-95"
          title="Reset to 100 ETH"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
    </div>
  );
}

function MyBetRow({ bet, isLast }: { bet: DemoBet; isLast: boolean }) {
  const potential = payoutFor(bet.stake, bet.oddsPct);
  const profit = potential - bet.stake;
  return (
    <div className={`grid grid-cols-12 gap-3 px-5 py-4 items-center ${isLast ? "" : "border-b border-white/5"}`}>
      <div className="col-span-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gaffer-gold/15 text-gaffer-gold font-display text-base">●</div>
      <div className="col-span-5 sm:col-span-5">
        <div className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">{bet.marketName.slice(0, 40)}{bet.marketName.length > 40 ? "…" : ""}</div>
        <div className="font-display text-base text-white truncate">{bet.optionLabel}</div>
      </div>
      <div className="col-span-2 text-right">
        <div className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">Stake</div>
        <div className="font-display text-base text-white tabular-nums">{bet.stake.toFixed(1)}</div>
      </div>
      <div className="col-span-2 text-right">
        <div className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">Odds</div>
        <div className="font-display text-base text-gaffer-gold tabular-nums">{bet.oddsPct}%</div>
      </div>
      <div className="col-span-2 text-right">
        <div className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">Pays</div>
        <div className="font-display text-base text-gaffer-electric tabular-nums">+{profit.toFixed(1)}</div>
      </div>
    </div>
  );
}

function BetModal({ ctx, bankroll, onClose, onPlace }: {
  ctx: { marketId: string; marketName: string; optionLabel: string; oddsPct: number };
  bankroll: number;
  onClose: () => void;
  onPlace: (stake: number) => void;
}) {
  const [stake, setStake] = useState<string>("1");
  const num = Number(stake) || 0;
  const valid = num > 0 && num <= bankroll;
  const potential = num > 0 ? payoutFor(num, ctx.oddsPct) : 0;
  const profit = potential - num;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gaffer-black/80 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-[2rem] p-1.5 bg-gradient-to-br from-gaffer-electric/50 via-white/10 to-gaffer-gold/30">
        <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface hairline inner-glow p-7">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-electric uppercase">Place demo bet</div>
              <h2 className="mt-2 font-display text-2xl text-white leading-tight">{ctx.optionLabel}</h2>
              <div className="font-mono text-[10px] tracking-[0.18em] text-white/45 mt-1 uppercase">on · {ctx.marketName.slice(0, 50)}{ctx.marketName.length > 50 ? "…" : ""}</div>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
          </div>

          <div className="mt-6 space-y-4">
            {/* Quick amounts */}
            <div>
              <label className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Stake (ETH)</label>
              <div className="mt-2 grid grid-cols-4 gap-2 mb-2">
                {[1, 5, 10, 25].map((v) => (
                  <button key={v} onClick={() => setStake(String(v))}
                    className={`py-2 rounded-xl font-mono text-sm transition-colors ${Number(stake) === v ? "bg-gaffer-electric/20 text-gaffer-electric ring-1 ring-gaffer-electric/40" : "bg-white/5 text-white/65 hover:bg-white/10"}`}>
                    {v}
                  </button>
                ))}
              </div>
              <input value={stake} onChange={(e) => setStake(e.target.value)}
                className="w-full bg-black/30 hairline rounded-xl px-4 py-3 text-white font-mono outline-none focus:ring-1 focus:ring-gaffer-electric/40" />
              <div className="mt-1 font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase text-right">
                Bankroll: {bankroll.toFixed(1)} ETH
              </div>
            </div>

            {/* Payout preview */}
            <div className="rounded-xl bg-gaffer-electric/10 hairline p-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">Implied</div>
                  <div className="font-display text-xl text-gaffer-gold tabular-nums">{ctx.oddsPct}%</div>
                </div>
                <div>
                  <div className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">If wins</div>
                  <div className="font-display text-xl text-gaffer-electric tabular-nums">{potential.toFixed(2)}</div>
                </div>
                <div>
                  <div className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">Profit</div>
                  <div className="font-display text-xl text-gaffer-electric tabular-nums">+{profit.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <button onClick={() => onPlace(num)} disabled={!valid}
              className={`w-full rounded-full py-3.5 font-display text-xl tracking-wider text-gaffer-black transition-transform duration-150 ease-out-strong active:scale-[0.97] ${valid ? "bg-gaffer-electric hover:brightness-110 animate-hot-edge" : "bg-white/10 text-white/30 cursor-not-allowed"}`}>
              {valid ? `PLACE ${num.toFixed(1)} ETH` : num > bankroll ? "INSUFFICIENT BANKROLL" : "ENTER STAKE"}
            </button>
            <div className="font-mono text-[9px] tracking-[0.22em] text-white/35 uppercase text-center">
              ★ Demo · settles on-chain when WC 2026 kicks off
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gaffer-electric">
      <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size + 2} viewBox="0 0 12 14" fill="none" className="text-gaffer-gold/80">
      <path d="M2 6V4a4 4 0 018 0v2M2 6h8v7H2V6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9zM10 21a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
