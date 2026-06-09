"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { HoverWord, LetterWave } from "@/components/ui/HoverText";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";
import playersData from "@/data/players.json";
import { Player } from "@/types";

const players = playersData as Player[];
const pick = (id: string) => players.find((p) => p.id === id)!;

const SCORING = [
  { pos: "GK",  rules: [["Clean sheet", "+12"], ["Goal", "+10"], ["Save", "+1"], ["Penalty save", "+5"], ["Goal conceded (every 2)", "-1"]] },
  { pos: "DEF", rules: [["Goal", "+8"],  ["Assist", "+6"], ["Clean sheet", "+8"], ["Goal conceded (every 2)", "-1"]] },
  { pos: "MID", rules: [["Goal", "+8"],  ["Assist", "+6"], ["Clean sheet", "+4"]] },
  { pos: "FWD", rules: [["Goal", "+10"], ["Assist", "+4"]] },
];

const STAGES = [
  { code: "GROUP", mult: "1.0×", note: "Matchdays 1–3" },
  { code: "R16",   mult: "1.2×", note: "Matchdays 4–5" },
  { code: "QF",    mult: "1.5×", note: "Matchday 6" },
  { code: "SF",    mult: "2.0×", note: "Matchday 7" },
  { code: "FINAL", mult: "3.0×", note: "Matchday 8" },
];

const RARITY_TIERS = [
  { tier: "BRONZE", min: 0,   accent: "#E0A668" },
  { tier: "SILVER", min: 30,  accent: "#E5E5E5" },
  { tier: "GOLD",   min: 80,  accent: "#F5D26C" },
  { tier: "ICON",   min: 150, accent: "#7FE3C0" },
];

const FAQ = [
  {
    q: "What does it cost to mint a squad?",
    a: "Zero — minting your 5-NFT squad is free. You only stake ETH when you accept a war.",
  },
  {
    q: "Can I trade my players after minting?",
    a: "Your squad is bound for the tournament. Player rarity upgrades are permanent and live on-chain — they cannot be undone.",
  },
  {
    q: "What happens in a draw?",
    a: "Equal scores → both sides refunded their stake minus the 5% protocol fee.",
  },
  {
    q: "What if my opponent doesn't lock their captain?",
    a: "If a manager never locks, their squad scores with the default captain (slot 0) and default bench (slot 4).",
  },
  {
    q: "Why Base?",
    a: "Sub-cent gas fees + 1-second blocks = fast, cheap matchday resolution. ETH is the native token.",
  },
];

export default function RulesPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        <Backdrop src={FOOTBALL_IMAGERY.tactics} opacity={0.18} blur={3} overlay="hero" blend="luminosity" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />

        <div className="relative mx-auto max-w-6xl">
          {/* HEADER */}
          <div className="flex flex-wrap items-end justify-between gap-6 mb-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] hairline px-3 py-1 hover-lift">
                <span className="font-mono text-[10px] tracking-[0.22em] text-white/70 uppercase">
                  The rulebook
                </span>
              </div>
              <h1 className="mt-5 font-display text-white text-7xl sm:text-9xl leading-[0.85]">
                <LetterWave text="How it" glow="white" charDelay={26} liftPx={10} /><br/>
                <span className="text-gaffer-gold">
                  <LetterWave text="works." glow="gold" charDelay={28} liftPx={12} />
                </span>
              </h1>
              <p className="mt-4 text-white/55 max-w-xl">
                Draft five real World Cup players. Stake ETH. Outscore your opponent on matchday.
                Forge bronze cards into permanent icons.
              </p>
            </div>
            <Link
              href="/squad"
              className="group inline-flex items-center gap-2 rounded-full bg-gaffer-gold pl-6 pr-2 py-2.5 text-gaffer-black
                transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-gaffer-gold-light"
            >
              <span className="font-display text-lg tracking-wider">START PLAYING</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gaffer-black/15 transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5">
                <Arrow />
              </span>
            </Link>
          </div>

          {/* 3-STEP LOOP */}
          <section>
            <SectionHead step="01" title="THE LOOP" subtitle="Three actions repeat every matchday." />
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <RuleTile n="01" title="DRAFT" accent="gold">
                <div className="flex gap-2 justify-center items-end mb-4">
                  <div className="-rotate-[5deg]"><PlayerCard player={pick("alisson")} rarity="SILVER" size="sm" tilt={false} /></div>
                  <div className="z-10 rotate-[2deg]"><PlayerCard player={pick("mbappe")} rarity="ICON" size="sm" tilt={false} /></div>
                  <div className="-rotate-[3deg]"><PlayerCard player={pick("rodri")} rarity="GOLD" size="sm" tilt={false} /></div>
                </div>
                <p className="text-white/65 text-sm leading-relaxed">
                  Pick exactly <HoverWord glow="electric">one goalkeeper</HoverWord> + four outfield players. Your squad mints as 5 ERC-721 NFTs you own forever.
                </p>
              </RuleTile>

              <RuleTile n="02" title="BATTLE" accent="electric">
                <div className="flex items-center justify-center gap-4 py-4">
                  <div className="text-center">
                    <div className="font-mono text-[9px] tracking-[0.2em] text-white/40">YOU</div>
                    <div className="font-display text-5xl text-gaffer-electric leading-none mt-1">87</div>
                  </div>
                  <div className="font-display text-4xl text-white/30">VS</div>
                  <div className="text-center">
                    <div className="font-mono text-[9px] tracking-[0.2em] text-white/40">THEM</div>
                    <div className="font-display text-5xl text-white/70 leading-none mt-1">64</div>
                  </div>
                </div>
                <p className="text-white/65 text-sm leading-relaxed">
                  Stake ETH. Pick your <HoverWord glow="gold">captain (2×)</HoverWord> + bench (0×) before kick-off. Highest score takes 95% of the pot.
                </p>
              </RuleTile>

              <RuleTile n="03" title="FORGE" accent="gold">
                <div className="grid grid-cols-4 gap-1.5 mb-4">
                  {RARITY_TIERS.map((r, i) => (
                    <div key={r.tier} className="aspect-[3/4] rounded-lg p-[1.5px]" style={{
                      background: `linear-gradient(180deg, ${r.accent}, ${r.accent}11)`,
                    }}>
                      <div className="h-full w-full rounded-[6px] bg-gaffer-surface flex flex-col items-center justify-center gap-1">
                        <div className="font-display text-base" style={{ color: r.accent }}>{r.tier[0]}</div>
                        <div className="font-mono text-[7px] tracking-[0.15em] text-white/40">{r.min}+</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-white/65 text-sm leading-relaxed">
                  Every point your player scores stacks onto their NFT. At <HoverWord glow="gold">30 / 80 / 150</HoverWord> pts they auto-upgrade to Silver / Gold / Icon.
                </p>
              </RuleTile>
            </div>
          </section>

          {/* STAGE MULTIPLIERS */}
          <section className="mt-24">
            <SectionHead step="02" title="STAGE MULTIPLIERS" subtitle="Knockout rounds compound your output." />
            <div className="mt-10 relative">
              <div className="hidden sm:block absolute top-[34%] left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-gaffer-gold/30 to-transparent" />
              <div className="grid grid-cols-5 gap-1 sm:gap-3">
                {STAGES.map((s, i) => (
                  <div key={s.code} className="reveal hover-lift" style={{ ["--stagger-delay" as any]: `${i * 70}ms` }}>
                    <div className={`rounded-2xl p-[1.5px] ${s.code === "FINAL" ? "bg-gradient-to-b from-gaffer-gold to-gaffer-gold/0" : "bg-white/[0.04] hairline-strong"}`}>
                      <div className="rounded-[calc(1rem-1.5px)] hairline inner-glow bg-gaffer-surface/60 p-3 sm:p-5 text-center">
                        <div className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">{s.note}</div>
                        <div className="font-display text-2xl sm:text-3xl text-white mt-2 leading-none tracking-wider">{s.code}</div>
                        <div className="mt-3 pt-3 border-t border-white/5">
                          <div className={`font-display text-3xl sm:text-5xl leading-none tabular-nums ${s.code === "FINAL" ? "text-gaffer-gold" : "text-white/85"}`}
                            style={s.code === "FINAL" ? { textShadow: "0 0 30px rgba(212,175,55,0.5)" } : undefined}>
                            {s.mult}
                          </div>
                          <div className="font-mono text-[8px] tracking-[0.22em] text-white/30 uppercase mt-1">multiplier</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-8 text-white/55 max-w-2xl text-sm">
              Example: a 20-point performance in the Group stage is worth 20 pts. The same performance in the Final is worth <HoverWord glow="gold">60 pts</HoverWord>. Captaining a player who explodes in the knockouts is how dynasties are made.
            </p>
          </section>

          {/* SCORING TABLE */}
          <section className="mt-24">
            <SectionHead step="03" title="SCORING" subtitle="Real performance, real points." />
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              {SCORING.map((s) => (
                <div key={s.pos} className="rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong hover-lift">
                  <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow p-6">
                    <div className="flex items-baseline justify-between mb-4">
                      <div>
                        <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-gold/80 uppercase">Position</div>
                        <div className="font-display text-3xl text-white mt-1">{s.pos}</div>
                      </div>
                      <div className="font-display text-6xl text-white/5 leading-none">{s.pos}</div>
                    </div>
                    <div className="space-y-2">
                      {s.rules.map(([action, pts]) => {
                        const isNeg = pts.startsWith("-");
                        return (
                          <div key={action} className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
                            <span className="text-white/70 text-sm">{action}</span>
                            <span className={`font-display text-xl tabular-nums ${isNeg ? "text-gaffer-red" : "text-gaffer-electric"}`}
                              style={{ textShadow: isNeg ? undefined : "0 0 12px rgba(34, 197, 141,0.2)" }}>
                              {pts}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* STAKES & FEES */}
          <section className="mt-24">
            <SectionHead step="04" title="STAKES & FEES" subtitle="No house edge. No subscription." />
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatBlock label="Mint cost" value="FREE" sub="0 ETH · only gas" tone="white" />
              <StatBlock label="Min stake" value="0.001" sub="ETH per side" tone="gold" />
              <StatBlock label="Winner takes" value="95%" sub="5% protocol fee" tone="electric" />
            </div>
          </section>

          {/* FAQ */}
          <section className="mt-24">
            <SectionHead step="05" title="FAQ" subtitle="Quick answers." />
            <div className="mt-10 rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong">
              <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/60 hairline inner-glow overflow-hidden">
                {FAQ.map((f, i) => (
                  <details key={i} className="group border-b border-white/5 last:border-b-0">
                    <summary className="flex items-center justify-between px-6 py-5 cursor-pointer hover:bg-white/[0.02] transition-colors duration-150 select-none list-none">
                      <span className="font-medium text-white text-base pr-4">
                        <HoverWord glow="gold">{f.q}</HoverWord>
                      </span>
                      <span className="font-display text-2xl text-gaffer-gold transition-transform duration-200 ease-out-strong group-open:rotate-45">+</span>
                    </summary>
                    <div className="px-6 pb-5 text-white/60 text-sm leading-relaxed">{f.a}</div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="mt-24 text-center">
            <p className="text-white/55 mb-4 font-mono text-[11px] tracking-[0.22em] uppercase">Ready?</p>
            <Link
              href="/squad"
              className="group inline-flex items-center gap-3 rounded-full bg-gaffer-gold pl-8 pr-2.5 py-3.5 text-gaffer-black
                transition-transform duration-150 ease-out-strong active:scale-[0.96] hover:bg-gaffer-gold-light animate-hot-edge"
            >
              <span className="font-display text-xl tracking-wider">BUILD YOUR FIVE</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gaffer-black/15 transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5">
                <Arrow />
              </span>
            </Link>
          </section>

          <RelatedLinks current="/rules" />
        </div>
      </main>
    </>
  );
}

function SectionHead({ step, title, subtitle }: { step: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-4">
      <div>
        <div className="font-mono text-[10px] tracking-[0.22em] text-gaffer-gold/80 uppercase">Section {step}</div>
        <h2 className="mt-2 font-display text-white text-5xl sm:text-6xl leading-[0.9]">
          <LetterWave text={title} glow="white" charDelay={18} liftPx={6} />
        </h2>
        <p className="mt-2 font-mono text-[11px] tracking-[0.2em] text-white/40 uppercase">{subtitle}</p>
      </div>
    </div>
  );
}

function RuleTile({ n, title, accent, children }: { n: string; title: string; accent: "gold" | "electric"; children: React.ReactNode }) {
  const ac = accent === "gold" ? "text-gaffer-gold" : "text-gaffer-electric";
  return (
    <div className="rounded-[2rem] p-1.5 bg-white/[0.04] hairline-strong hover-lift">
      <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/70 hairline inner-glow p-6 sm:p-8 relative overflow-hidden h-full flex flex-col">
        <div className={`absolute -right-12 -top-12 w-56 h-56 rounded-full blur-3xl ${accent === "gold" ? "bg-gaffer-gold/10" : "bg-gaffer-electric/10"}`} />
        <div className="relative flex items-baseline justify-between mb-4">
          <div>
            <div className={`font-mono text-[10px] tracking-[0.22em] uppercase opacity-80 ${ac}`}>Step {n}</div>
            <div className={`font-display text-5xl mt-2 ${ac}`}>{title}</div>
          </div>
          <div className="font-display text-7xl text-white/5 leading-none">{n}</div>
        </div>
        <div className="relative mt-auto">{children}</div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "gold" | "electric" | "white" }) {
  const accent = { gold: "text-gaffer-gold", electric: "text-gaffer-electric", white: "text-white" }[tone];
  return (
    <div className="rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong hover-lift">
      <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">{label}</div>
        <div className={`font-display text-6xl tabular-nums leading-none mt-2 ${accent}`}>{value}</div>
        <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase mt-2">{sub}</div>
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
