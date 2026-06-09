"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Backdrop } from "@/components/ui/Backdrop";
import { LetterWave } from "@/components/ui/HoverText";
import { RelatedLinks } from "@/components/ui/RelatedLinks";
import { FOOTBALL_IMAGERY } from "@/lib/imagery";

// ─── PAGE ────────────────────────────────────────────────────────────────────
export default function PredictPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
        <Backdrop src={FOOTBALL_IMAGERY.trophy} opacity={0.22} blur={3} overlay="hero" blend="luminosity" scale={1.05} />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-left" />
        <div className="pointer-events-none absolute inset-0 -z-10 floodlight-right" />
        <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-25" />

        <div className="relative mx-auto max-w-3xl flex flex-col items-center text-center min-h-[60vh] justify-center">
          {/* EYEBROW */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] hairline px-3 py-1 hover-lift">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gaffer-electric" />
            <span className="font-mono text-[10px] tracking-[0.22em] text-white/70 uppercase">
              Predictions
            </span>
          </div>

          {/* HEADLINE */}
          <h1 className="mt-6 font-display text-white text-7xl sm:text-9xl leading-[0.85]">
            <LetterWave text="Coming" glow="white" charDelay={28} liftPx={12} /><br />
            <span className="text-gaffer-gold">
              <LetterWave text="soon." glow="gold" charDelay={30} liftPx={14} />
            </span>
          </h1>

          {/* SUBLINE */}
          <p className="mt-6 text-white/55 max-w-lg leading-relaxed">
            Prediction markets arrive when the tournament begins. Until then, sharpen your edge on
            the pitch.
          </p>

          {/* SECONDARY LINK */}
          <div className="mt-10">
            <Link
              href="/wars"
              className="group inline-flex items-center gap-3 rounded-full bg-white/[0.05] hairline pl-6 pr-2.5 py-3 text-white/85
                transition-transform duration-150 ease-out-strong active:scale-[0.97] hover:bg-white/[0.1]"
            >
              <span className="font-display text-lg tracking-wider">ENTER THE WARS</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5">
                <Arrow />
              </span>
            </Link>
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl">
          <RelatedLinks current="/predict" />
        </div>
      </main>
    </>
  );
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
