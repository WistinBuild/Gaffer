"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import playersData from "@/data/players.json";
import { Player } from "@/types";

const players = playersData as Player[];
const pick = (id: string) => players.find((p) => p.id === id)!;

type EventType = "war_created" | "war_accepted" | "war_resolved" | "forged" | "minted" | "big_stake";

interface FeedEvent {
  id: string;
  type: EventType;
  at: string; // relative time
  manager: string;
  manager2?: string;
  player?: string;
  amount?: string;
  score?: string;
  fromTier?: string;
  toTier?: string;
  reason?: string;
}

const FEED: FeedEvent[] = [
  { id: "e1",  type: "forged",       at: "12s ago", manager: "elGoatManager", player: "vinicius",   fromTier: "GOLD",   toTier: "ICON",   reason: "31 pts vs France" },
  { id: "e2",  type: "big_stake",    at: "47s ago", manager: "0x4a7…dE12",     amount: "0.50" },
  { id: "e3",  type: "war_resolved", at: "1m ago",  manager: "elGoatManager",  manager2: "0x4a7…dE12", score: "92–64", amount: "+0.095" },
  { id: "e4",  type: "war_accepted", at: "2m ago",  manager: "tikitaka.eth",   manager2: "Cristiano21", amount: "0.10" },
  { id: "e5",  type: "war_created",  at: "3m ago",  manager: "0x9c1…7Fa3",     amount: "0.02" },
  { id: "e6",  type: "minted",       at: "5m ago",  manager: "iniestaCR" },
  { id: "e7",  type: "forged",       at: "6m ago",  manager: "Cristiano21",    player: "saka",       fromTier: "SILVER", toTier: "GOLD",   reason: "Hat-trick MD3" },
  { id: "e8",  type: "war_resolved", at: "8m ago",  manager: "tikitaka.eth",   manager2: "0x71a…99c0", score: "78–61", amount: "+0.05" },
  { id: "e9",  type: "war_created",  at: "11m ago", manager: "fcSamba",        amount: "0.08" },
  { id: "e10", type: "big_stake",    at: "14m ago", manager: "0x33e…aaaa",     amount: "1.20" },
  { id: "e11", type: "forged",       at: "18m ago", manager: "totalfutbol",    player: "musiala",    fromTier: "GOLD",   toTier: "ICON",   reason: "MD3 MOTM" },
  { id: "e12", type: "war_accepted", at: "22m ago", manager: "elGoatManager",  manager2: "0x4a7…dE12", amount: "0.05" },
  { id: "e13", type: "war_resolved", at: "26m ago", manager: "Cristiano21",    manager2: "iniestaCR", score: "44–67", amount: "+0.03" },
  { id: "e14", type: "minted",       at: "32m ago", manager: "0x88c…4d21" },
  { id: "e15", type: "forged",       at: "41m ago", manager: "tikitaka.eth",   player: "ruben_dias", fromTier: "SILVER", toTier: "GOLD",   reason: "Clean sheet + assist" },
];

const FILTERS: { key: string; label: string; types: EventType[] }[] = [
  { key: "all",      label: "All",      types: [] },
  { key: "wars",     label: "Wars",     types: ["war_created", "war_accepted", "war_resolved"] },
  { key: "forgings", label: "Forgings", types: ["forged"] },
  { key: "stakes",   label: "Big stakes", types: ["big_stake"] },
  { key: "mints",    label: "New squads", types: ["minted"] },
];

export default function FeedPage() {
  const [filterKey, setFilterKey] = useState("all");
  const filter = FILTERS.find((f) => f.key === filterKey)!;
  const filtered = filter.types.length === 0 ? FEED : FEED.filter((e) => filter.types.includes(e.type));

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

          {/* EMPTY STATE */}
          {filtered.length === 0 && (
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
        dotColor: isIcon ? "#7CFFC4" : "#F5D26C",
        body: (
          <>
            <HoverWord glow="gold">{e.manager}</HoverWord>'s{" "}
            <HoverWord glow={isIcon ? "electric" : "gold"}>{pick(e.player!).shortName}</HoverWord>{" "}
            forged <span className="text-white/40">{e.fromTier}</span>{" "}
            <span className="text-white/60">→</span>{" "}
            <span style={{ color: isIcon ? "#7CFFC4" : "#F5D26C" }}>{e.toTier}</span>
          </>
        ),
      };
    }
    case "war_resolved": {
      return {
        tag: "RESOLVED",
        dotColor: "#00FF87",
        body: (
          <>
            <HoverWord glow="electric">{e.manager}</HoverWord> beat{" "}
            <HoverWord glow="white">{e.manager2}</HoverWord> · final{" "}
            <span className="font-mono text-gaffer-electric">{e.score}</span>
          </>
        ),
        right: e.amount,
        rightColor: "#00FF87",
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
        right: `${e.amount} ETH`,
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
        right: `${e.amount} ETH`,
      };
    }
    case "big_stake": {
      return {
        tag: "WHALE",
        dotColor: "#FF3B3B",
        body: (
          <>
            <HoverWord glow="red">{e.manager}</HoverWord> dropped a heavy stake
          </>
        ),
        right: `${e.amount} ETH`,
        rightColor: "#FF3B3B",
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
