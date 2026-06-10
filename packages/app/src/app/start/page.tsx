"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { LetterWave } from "@/components/ui/HoverText";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

type Step = {
  n: string;
  title: string;
  body: string;
  accent: string;
  links: { label: string; href: string; external?: boolean; primary?: boolean }[];
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "Connect a wallet",
    body: "MetaMask, Rabby, Coinbase Wallet or any WalletConnect app. Gaffer auto-switches you to the Base Sepolia test network — just approve the prompt.",
    accent: "#D4AF37",
    links: [],
  },
  {
    n: "02",
    title: "Grab test ETH (for gas)",
    body: "You need a little Base Sepolia ETH to pay gas. Claim it free from a faucet — paste your wallet address.",
    accent: "#7FE3C0",
    links: [
      { label: "Coinbase faucet ↗", href: "https://portal.cdp.coinbase.com/products/faucet", external: true, primary: true },
      { label: "Alchemy faucet ↗", href: "https://www.alchemy.com/faucets/base-sepolia", external: true },
      { label: "QuickNode faucet ↗", href: "https://faucet.quicknode.com/base/sepolia", external: true },
    ],
  },
  {
    n: "03",
    title: "Grab test USDC (to play)",
    body: "Everything in Gaffer is paid in USDC — minting players and staking wars. Claim test USDC on Base Sepolia from Circle's faucet.",
    accent: "#2775CA",
    links: [
      { label: "Circle USDC faucet ↗", href: "https://faucet.circle.com/", external: true, primary: true },
    ],
  },
  {
    n: "04",
    title: "Open your free starter pack",
    body: "Every wallet gets a free 5-player pack to get started — no cost. Open it, then head to your squad.",
    accent: "#D4AF37",
    links: [
      { label: "Open my pack →", href: "/play?pack=open", primary: true },
    ],
  },
  {
    n: "05",
    title: "Mint legends & build your five",
    body: "Mint World Cup icons as NFTs from the market — Pelé, Maradona, Zidane and more, from just 1 USDC. You need a valid 5-player squad (1 GK + 4 outfield) to enter wars.",
    accent: "#F5D26C",
    links: [
      { label: "Browse the market →", href: "/marketplace", primary: true },
      { label: "My squad →", href: "/squad" },
    ],
  },
  {
    n: "06",
    title: "Enter Squad Wars",
    body: "Stake USDC head-to-head, pick your captain (2× points) and bench, then outscore your rival on matchday. An on-chain Oracle settles it — winner takes 95% of the pot.",
    accent: "#22C58D",
    links: [
      { label: "Find a war →", href: "/wars", primary: true },
      { label: "How scoring works →", href: "/rules" },
    ],
  },
];

export default function StartPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        <Backdrop src={FOOTBALL_IMAGERY.cosmicStadium ?? FOOTBALL_IMAGERY.trophy} opacity={0.22} blur={3} overlay="hero" blend="luminosity" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-30" />

        <div className="relative mx-auto max-w-4xl">
          {/* HEADER */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full bg-gaffer-electric/15 hairline px-3 py-1 hover-lift">
              <span className="h-1.5 w-1.5 rounded-full bg-gaffer-electric animate-live-dot" />
              <span className="font-mono text-[10px] tracking-[0.22em] text-gaffer-electric uppercase">
                Live on Base Sepolia · Free to try
              </span>
            </div>
            <h1 className="mt-5 font-display text-white text-6xl sm:text-8xl leading-[0.86]">
              <LetterWave text="Start" glow="white" charDelay={28} liftPx={12} />{" "}
              <span className="text-gaffer-gold"><LetterWave text="playing." glow="gold" charDelay={30} liftPx={14} /></span>
            </h1>
            <p className="mt-4 text-white/60 max-w-xl mx-auto">
              Gaffer runs on the Base Sepolia testnet — no real money, just claim free test
              tokens and play. Six steps and you&apos;re managing a squad.
            </p>
            <div className="mt-6 inline-block"><ConnectButton /></div>
          </div>

          {/* STEPS */}
          <div className="space-y-4">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="reveal rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong hover-lift"
                style={{ ["--stagger-delay" as any]: `${i * 70}ms` }}
              >
                <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow p-6 sm:p-7 flex gap-5">
                  <div
                    className="shrink-0 font-display text-5xl sm:text-6xl tabular-nums leading-none"
                    style={{ color: s.accent, textShadow: `0 0 20px ${s.accent}40` }}
                  >
                    {s.n}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-display text-2xl sm:text-3xl text-white tracking-wide">{s.title}</h2>
                    <p className="mt-2 text-white/60 text-[15px] leading-relaxed max-w-2xl">{s.body}</p>
                    {s.links.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-2.5">
                        {s.links.map((l) =>
                          l.external ? (
                            <a
                              key={l.label}
                              href={l.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.12em] uppercase transition-all duration-150 active:scale-95 ${
                                l.primary
                                  ? "bg-gaffer-gold text-gaffer-black hover:bg-gaffer-gold-light"
                                  : "bg-white/5 hairline text-white/75 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {l.label}
                            </a>
                          ) : (
                            <Link
                              key={l.label}
                              href={l.href}
                              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.12em] uppercase transition-all duration-150 active:scale-95 ${
                                l.primary
                                  ? "bg-gaffer-electric text-gaffer-black hover:brightness-110"
                                  : "bg-white/5 hairline text-white/75 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {l.label}
                            </Link>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* USDC token helper */}
          <div className="mt-8 rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong">
            <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/60 hairline inner-glow p-6">
              <div className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase mb-2">
                Can&apos;t see your USDC? Add the token to your wallet
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <code className="font-mono text-[13px] text-gaffer-gold break-all">{USDC_ADDRESS}</code>
                <span className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">· Base Sepolia · 6 decimals</span>
              </div>
            </div>
          </div>

          {/* CTA footer */}
          <div className="mt-12 text-center">
            <p className="font-mono text-[11px] tracking-[0.22em] text-white/40 uppercase">
              Built on Base · Follow{" "}
              <a href="https://x.com/gaffer_game" target="_blank" rel="noopener noreferrer" className="text-gaffer-gold hover:text-white transition-colors">@gaffer_game</a>
            </p>
          </div>

          <RelatedLinks current="/start" />
        </div>
      </main>
    </>
  );
}
