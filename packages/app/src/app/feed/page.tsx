"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import playersData from "@/data/players.json";
import { Player } from "@/types";
import { useAllWars, shortAddr, hasContracts, type ChainWar } from "@/lib/onchain";
import { fromUSDC } from "@/lib/usdcSolana";
const zeroAddress = "11111111111111111111111111111111"; // Solana default pubkey = "no winner"

const players = playersData as Player[];
const pick = (id: string) => players.find((p) => p.id === id)!;

type EventType = "war_created" | "war_accepted" | "war_resolved" | "forged" | "minted" | "big_stake";

interface FeedEvent {
  id: string;
  type: EventType;
  at: string; // honest label (no fabricated relative time)
  manager: string;
  manager2?: string;
  player?: string;
  amount?: string;
  score?: string;
  fromTier?: string;
  toTier?: string;
  reason?: string;
}

// Build feed events from real on-chain wars (newest first).
function eventsFromWars(wars: ChainWar[]): FeedEvent[] {
  const sorted = [...wars].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  const events: FeedEvent[] = [];

  for (const w of sorted) {
    const id = Number(w.id);
    const md = Number(w.matchday);

    // status === 2 → resolved
    if (w.status === 2) {
      const draw = w.winner === zeroAddress;
      events.push({
        id: `w${id}-resolved`,
        type: "war_resolved",
        at: `MD ${md}`,
        manager: draw ? "Draw" : shortAddr(w.winner),
        manager2: shortAddr(w.challenger === w.winner ? w.opponent : w.challenger),
        score: `${w.challengerScore}–${w.opponentScore}`,
      });
    }

    // status >= 1 → accepted / active / resolved
    if (w.status >= 1) {
      events.push({
        id: `w${id}-accepted`,
        type: "war_accepted",
        at: `War #${id}`,
        manager: shortAddr(w.challenger),
        manager2: shortAddr(w.opponent),
      });
    }

    // status >= 0 → exists / created
    if (w.status >= 0) {
      events.push({
        id: `w${id}-created`,
        type: "war_created",
        at: `MD ${md}`,
        manager: shortAddr(w.challenger),
        amount: String(fromUSDC(w.stake)),
      });
    }
  }

  return events;
}

const FILTERS: { key: string; label: string; types: EventType[] }[] = [
  { key: "all",      label: "All",      types: [] },
  { key: "wars",     label: "Wars",     types: ["war_created", "war_accepted", "war_resolved"] },
  { key: "created",  label: "Posted",   types: ["war_created"] },
  { key: "accepted", label: "Accepted", types: ["war_accepted"] },
  { key: "resolved", label: "Resolved", types: ["war_resolved"] },
];

export default function FeedPage() {
  const [filterKey, setFilterKey] = useState("all");
  const { wars, isLoading } = useAllWars();

  const feed = useMemo(() => eventsFromWars(wars), [wars]);

  const filter = FILTERS.find((f) => f.key === filterKey)!;
  const filtered = filter.types.length === 0 ? feed : feed.filter((e) => filter.types.includes(e.type));

  const showEmpty = !isLoading && feed.length === 0;

  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        <Backdrop src={FOOTBALL_IMAGERY.crowd} opacity={0.2} blur={5} overlay="hero" blend="luminosity" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-30" />

        <div className="relative mx-auto max-w-4xl">
          {/* HEADER */}
          <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gaffer-red/15 hairline px-3 py-1 hover-lift">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gaffer-red animate-live-dot" />
                <span className="font-mono text-[10px] tracking-[0.22em] text-white/80 uppercase">
                  Live feed · {filtered.length} events
                </span>
              </div>
              <h1 className="mt-5 font-display text-white text-7xl sm:text-9xl leading-[0.85]">
                <LetterWave text="The" glow="white" charDelay={28} liftPx={12} />{" "}
                <span className="text-gaffer-electric">
                  <LetterWave text="pulse." glow="electric" charDelay={30} liftPx={12} />
                </span>
              </h1>
              <p className="mt-3 text-white/55 max-w-xl">
                Every war posted, every captain locked, every bronze card forged into icon — real-time.
              </p>
            </div>
            <Link
              href="/wars"
              className="group inline-flex items-center gap-2 rounded-full bg-gaffer-gold pl-6 pr-2 py-2.5 text-gaffer-black
                transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light"
            >
              <span className="font-display text-lg tracking-wider">JOIN A WAR</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gaffer-black/15 transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5">
                <Arrow />
              </span>
            </Link>
          </div>

          {/* FILTER PILLS */}
          <div className="inline-flex rounded-full p-[1.5px] bg-white/[0.04] hairline-strong mb-8">
            <div className="rounded-full bg-gaffer-black/50 hairline p-1 flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterKey(f.key)}
                  className={`px-4 py-1.5 rounded-full font-mono text-[11px] tracking-[0.15em] uppercase transition-all duration-150 ease-out-strong active:scale-95 ${
                    filterKey === f.key ? "bg-gaffer-gold text-gaffer-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* TIMELINE */}
          <div className="relative">
            {/* vertical guide line */}
            <div className="absolute left-5 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />

            <div className="space-y-3">
              {filtered.map((e, i) => (
                <div key={e.id} className="reveal" style={{ ["--stagger-delay" as any]: `${i * 40}ms` }}>
                  <FeedRow event={e} />
                </div>
              ))}
            </div>
          </div>

          {/* EMPTY STATE — no on-chain activity */}
          {showEmpty && (
            <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
              <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow p-12 text-center">
                <div className="font-display text-white text-3xl">No on-chain activity yet.</div>
                <p className="mt-2 text-white/55">
                  {hasContracts
                    ? "No wars have been posted on-chain yet. Be the first to start one."
                    : "Connect to a network with deployed contracts to see live wars."}
                </p>
                <Link
                  href="/wars"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-gaffer-gold/15 hairline px-5 py-2
                    text-gaffer-gold font-mono text-[11px] tracking-[0.18em] uppercase transition-colors duration-150 hover:bg-gaffer-gold/25"
                >
                  Start a war
                  <Arrow size={12} />
                </Link>
              </div>
            </div>
          )}

          {/* EMPTY STATE — filter has no matching events */}
          {!showEmpty && filtered.length === 0 && (
            <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
              <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow p-12 text-center">
                <div className="font-display text-white text-3xl">Quiet right now.</div>
                <p className="mt-2 text-white/55">Try another filter or check back when matchday kicks off.</p>
              </div>
            </div>
          )}

          <RelatedLinks current="/feed" />
        </div>
      </main>
    </>
  );
}

// ─── PIECES ─────────────────────────────────────────────────────────────────

function FeedRow({ event: e }: { event: FeedEvent }) {
  const meta = renderMeta(e);
  return (
    <div className="relative pl-14 group hover-lift">
      {/* Dot */}
      <div className="absolute left-3.5 top-3.5 w-3 h-3 rounded-full" style={{ background: meta.dotColor, boxShadow: `0 0 12px ${meta.dotColor}aa` }} />

      <div className="rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong group-hover:bg-white/[0.08] transition-colors duration-200">
        <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/60 hairline inner-glow backdrop-blur-sm px-5 py-4 flex items-center gap-4">
          {/* Type badge */}
          <div className="shrink-0">
            <div className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold tracking-[0.2em]" style={{
              background: `${meta.dotColor}22`,
              color: meta.dotColor,
            }}>
              {meta.tag}
            </div>
          </div>

          {/* Player avatar (if relevant) */}
          {e.player && (
            <img
              src={`/players/${e.player}.png`}
              alt=""
              className="h-10 w-10 rounded-full object-cover bg-gaffer-pitch ring-1"
              style={{ borderColor: meta.dotColor }}
              draggable={false}
              onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none"; }}
            />
          )}

          {/* Main text */}
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm leading-snug">{meta.body}</div>
            {e.reason && (
              <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase mt-1">
                {e.reason}
              </div>
            )}
          </div>

          {/* Right meta */}
          <div className="text-right shrink-0">
            {meta.right && (
              <div className="font-display text-xl tabular-nums" style={{ color: meta.rightColor ?? "#fff" }}>
                {meta.right}
              </div>
            )}
            <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase mt-0.5">{e.at}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderMeta(e: FeedEvent): {
  tag: string;
  dotColor: string;
  body: React.ReactNode;
  right?: string;
  rightColor?: string;
} {
  switch (e.type) {
    case "forged": {
      const isIcon = e.toTier === "ICON";
      return {
        tag: "FORGED",
        dotColor: isIcon ? "#7FE3C0" : "#F5D26C",
        body: (
          <>
            <HoverWord glow="gold">{e.manager}</HoverWord>'s{" "}
            <HoverWord glow={isIcon ? "electric" : "gold"}>{pick(e.player!).shortName}</HoverWord>{" "}
            forged <span className="text-white/40">{e.fromTier}</span>{" "}
            <span className="text-white/60">→</span>{" "}
            <span style={{ color: isIcon ? "#7FE3C0" : "#F5D26C" }}>{e.toTier}</span>
          </>
        ),
      };
    }
    case "war_resolved": {
      const isDraw = e.manager === "Draw";
      return {
        tag: "RESOLVED",
        dotColor: "#22C58D",
        body: isDraw ? (
          <>
            War drawn · final{" "}
            <span className="font-mono text-gaffer-electric">{e.score}</span>
          </>
        ) : (
          <>
            <HoverWord glow="electric">{e.manager}</HoverWord> beat{" "}
            <HoverWord glow="white">{e.manager2}</HoverWord> · final{" "}
            <span className="font-mono text-gaffer-electric">{e.score}</span>
          </>
        ),
        right: e.amount,
        rightColor: "#22C58D",
      };
    }
    case "war_accepted": {
      return {
        tag: "ACCEPTED",
        dotColor: "#F5D26C",
        body: (
          <>
            <HoverWord glow="gold">{e.manager}</HoverWord> accepted{" "}
            <HoverWord glow="white">{e.manager2}</HoverWord>'s challenge
          </>
        ),
        right: `${e.amount} USDC`,
        rightColor: "#F5D26C",
      };
    }
    case "war_created": {
      return {
        tag: "POSTED",
        dotColor: "#F5D26C",
        body: (
          <>
            <HoverWord glow="gold">{e.manager}</HoverWord> posted a new war
          </>
        ),
        right: `${e.amount} USDC`,
      };
    }
    case "big_stake": {
      return {
        tag: "WHALE",
        dotColor: "#E25563",
        body: (
          <>
            <HoverWord glow="red">{e.manager}</HoverWord> dropped a heavy stake
          </>
        ),
        right: `${e.amount} USDC`,
        rightColor: "#E25563",
      };
    }
    case "minted": {
      return {
        tag: "MINTED",
        dotColor: "#FFFFFF",
        body: (
          <>
            <HoverWord glow="white">{e.manager}</HoverWord> minted a new squad
          </>
        ),
      };
    }
  }
}

function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
