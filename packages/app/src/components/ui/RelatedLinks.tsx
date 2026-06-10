"use client";

import Link from "next/link";
import { HoverWord } from "./HoverText";

interface PageMeta {
  href: string;
  label: string;
  sub: string;
  glyph: string;
}

const ALL_PAGES: PageMeta[] = [
  { href: "/start",       label: "Start here",         sub: "Get test tokens · play in 6 steps", glyph: "▶" },
  { href: "/squad",       label: "Squad builder",      sub: "Draft your five NFTs",         glyph: "✦" },
  { href: "/marketplace", label: "The Market",         sub: "Mint legends · trade players", glyph: "◇" },
  { href: "/wars",        label: "Squad Wars",         sub: "1v1 matchday battles",          glyph: "⚔" },
  { href: "/predict",     label: "Prediction markets", sub: "Outrights · matches · novelty", glyph: "◊" },
  { href: "/leaderboard", label: "Leaderboard",        sub: "Top managers · live",           glyph: "★" },
  { href: "/feed",        label: "Live feed",          sub: "Every war · every forging",     glyph: "▰" },
  { href: "/profile",     label: "My Gaffer",          sub: "Squad · history · trophies",    glyph: "◉" },
  { href: "/rules",       label: "How it works",       sub: "Rules · scoring · stages",      glyph: "?" },
];

interface RelatedLinksProps {
  current: string;
  title?: string;
  limit?: number;
}

/**
 * Cross-link footer for interior pages. Renders 3–4 links to other pages,
 * excluding the current one. Place at the bottom of every game page so the
 * whole app is always one click away.
 */
export function RelatedLinks({ current, title = "Where to next", limit = 4 }: RelatedLinksProps) {
  const links = ALL_PAGES.filter((p) => p.href !== current).slice(0, limit);

  return (
    <section className="mt-24">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] hairline px-3 py-1 font-mono text-[10px] tracking-[0.22em] text-white/70 uppercase hover-lift">
            More to do
          </div>
          <h2 className="mt-4 font-display text-white text-4xl sm:text-5xl leading-[0.9]">
            {title}<span className="text-gaffer-gold">.</span>
          </h2>
        </div>
        <Link href="/" className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/50 hover:text-gaffer-gold transition-colors hover-lift">
          ← Back to portal
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {links.map((l, i) => (
          <Link
            key={l.href}
            href={l.href}
            className="reveal group rounded-2xl p-[1.5px] bg-white/[0.04] hairline-strong hover-lift hover:bg-gradient-to-br hover:from-gaffer-gold/40 hover:to-transparent transition-all duration-200"
            style={{ ["--stagger-delay" as any]: `${i * 60}ms` }}
          >
            <div className="rounded-[calc(1rem-1.5px)] bg-gaffer-surface/70 hairline inner-glow p-5 h-full flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <span className="font-display text-3xl text-gaffer-gold leading-none transition-transform duration-300 ease-out-strong group-hover:scale-110"
                  style={{ textShadow: "0 0 16px rgba(212,175,55,0.3)" }}>
                  {l.glyph}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white/30 transition-all duration-200 group-hover:text-gaffer-gold group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="font-display text-xl text-white leading-tight group-hover:text-gaffer-gold transition-colors duration-200">
                  <HoverWord glow="gold">{l.label}</HoverWord>
                </div>
                <div className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase mt-2 leading-relaxed">
                  {l.sub}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
