"use client";

import Link from "next/link";
import { useState } from "react";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { BuyGaffer } from "@/components/ui/BuyGaffer";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { XLink } from "@/components/ui/XLink";
import { playClick, playHover, unlockAudio } from "@/lib/sounds";

// Three clusters separated by visual dividers in the pill nav
const LINK_GROUPS: { label: string; href: string; group: "play" | "discover" | "you" }[] = [
  // PLAY — what you do
  { href: "/start",       label: "Start",  group: "play" },
  { href: "/squad",       label: "Squad",  group: "play" },
  { href: "/wars",        label: "Wars",   group: "play" },
  { href: "/match/12",    label: "Match",  group: "play" },
  // DISCOVER — what's happening
  { href: "/marketplace", label: "Market", group: "discover" },
  { href: "/predict",     label: "Predict",group: "discover" },
  { href: "/leaderboard", label: "Board",  group: "discover" },
  { href: "/feed",        label: "Live",   group: "discover" },
  // YOU — your stuff
  { href: "/profile",     label: "Me",     group: "you" },
];

const playLinks = LINK_GROUPS.filter((l) => l.group === "play");
const discoverLinks = LINK_GROUPS.filter((l) => l.group === "discover");
const youLinks = LINK_GROUPS.filter((l) => l.group === "you");

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop (lg+) — floating glass pill */}
      <nav className="fixed top-4 sm:top-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
        <div
          className="pointer-events-auto flex items-center gap-1 rounded-full
            bg-black/40 backdrop-blur-xl hairline-strong inner-glow
            pl-2 pr-2 py-2 max-w-full"
          style={{ boxShadow: "0 24px 60px -24px rgba(0,0,0,0.6)" }}
        >
          {/* Logo lockup */}
          <Link
            href="/"
            onClick={() => { unlockAudio().then(playClick).catch(() => {}); }}
            className="flex items-center gap-2 rounded-full px-3 py-1 shrink-0
              transition-transform duration-150 ease-out-strong active:scale-[0.97]"
          >
            <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full overflow-hidden ring-1 ring-gaffer-gold/40">
              <img
                src="/logo.svg"
                alt="GAFFER"
                className="h-full w-full object-cover"
                draggable={false}
              />
            </span>
            <span className="font-display text-white text-xl leading-none tracking-wider hidden sm:inline">
              GAFFER
            </span>
          </Link>

          {/* Divider */}
          <div className="hidden lg:block h-5 w-px bg-white/10 mx-1" />

          {/* Links — grouped clusters with subtle dividers */}
          <div className="hidden lg:flex items-center gap-0.5">
            {LINK_GROUPS.map((l, i) => {
              const prevGroup = i > 0 ? LINK_GROUPS[i - 1].group : null;
              const showDivider = prevGroup && prevGroup !== l.group;
              return (
                <span key={l.href} className="flex items-center gap-0.5">
                  {showDivider && <span className="h-3 w-px bg-white/8 mx-1" />}
                  <Link
                    href={l.href}
                    onClick={() => { unlockAudio().then(playClick).catch(() => {}); }}
                    onMouseEnter={() => playHover()}
                    className="rounded-full px-3 py-1.5 text-[13px] text-white/70 hover:text-white
                      hover:bg-white/5 transition-all duration-150 ease-out-strong active:scale-95
                      hover:-translate-y-0.5"
                  >
                    {l.label}
                  </Link>
                </span>
              );
            })}
          </div>

          {/* Divider */}
          <div className="hidden lg:block h-5 w-px bg-white/10 mx-1" />

          {/* Sound toggle */}
          <div className="hidden lg:block">
            <SoundToggle />
          </div>

          {/* X / social */}
          <div className="hidden lg:flex items-center justify-center h-9 w-9 rounded-full hover:bg-white/5 transition-colors duration-150">
            <XLink size={16} />
          </div>

          {/* $GAFFER contract address */}
          <div className="hidden lg:block">
            <BuyGaffer variant="compact" />
          </div>

          {/* CTA */}
          <div className="hidden lg:block">
            <ConnectButton />
          </div>

          {/* Mobile (< lg) — hamburger only */}
          <button
            onClick={() => {
              unlockAudio().then(playClick).catch(() => {});
              setOpen((o) => !o);
            }}
            className="lg:hidden relative h-9 w-9 rounded-full bg-white/5 hairline ml-1
              transition-transform duration-150 ease-out-strong active:scale-[0.95]"
            aria-label="Menu"
            aria-expanded={open}
          >
            <span
              className={`absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 bg-white
                transition-transform duration-300 ease-out-strong
                ${open ? "rotate-45 translate-y-0" : "-translate-y-1.5"}`}
            />
            <span
              className={`absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 bg-white
                transition-opacity duration-150 ${open ? "opacity-0" : "opacity-100"}`}
            />
            <span
              className={`absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 bg-white
                transition-transform duration-300 ease-out-strong
                ${open ? "-rotate-45 translate-y-0" : "translate-y-1.5"}`}
            />
          </button>
        </div>
      </nav>

      {/* Mobile expanded menu (< lg) */}
      <div
        className={`lg:hidden fixed inset-0 z-30 transition-opacity duration-300 ease-out-strong
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <div
          className="absolute inset-0 bg-gaffer-black/95 backdrop-blur-2xl"
          onClick={() => setOpen(false)}
        />
        <div className="relative h-full flex flex-col items-center justify-center gap-6 px-6 overflow-y-auto py-24">
          {/* Three cluster sections */}
          {[
            { title: "Play",     links: playLinks },
            { title: "Discover", links: discoverLinks },
            { title: "You",      links: youLinks },
          ].map((section, sIdx) => (
            <div key={section.title} className="w-full max-w-sm text-center">
              <div
                className="font-mono text-[10px] tracking-[0.32em] uppercase text-gaffer-gold/60 mb-3"
                style={{
                  opacity: open ? 1 : 0,
                  transition: `opacity 350ms cubic-bezier(0.23,1,0.32,1) ${80 + sIdx * 120}ms`,
                }}
              >
                — {section.title}
              </div>
              <div className="flex flex-col gap-2">
                {section.links.map((l, i) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => {
                      unlockAudio().then(playClick).catch(() => {});
                      setOpen(false);
                    }}
                    className="font-display text-3xl sm:text-4xl text-white/90 hover:text-gaffer-gold
                      transition-colors duration-200 leading-none py-1.5"
                    style={{
                      opacity: open ? 1 : 0,
                      transform: open ? "translateY(0)" : "translateY(16px)",
                      transition: `opacity 350ms cubic-bezier(0.23,1,0.32,1) ${
                        120 + sIdx * 120 + i * 50
                      }ms, transform 450ms cubic-bezier(0.23,1,0.32,1) ${120 + sIdx * 120 + i * 50}ms, color 200ms`,
                    }}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* Wallet + sound (bottom) */}
          <div
            className="mt-2 w-full max-w-sm flex flex-col items-center gap-4"
            style={{
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(20px)",
              transition: `opacity 400ms cubic-bezier(0.23,1,0.32,1) ${
                100 + 3 * 120 + LINK_GROUPS.length * 50
              }ms, transform 500ms cubic-bezier(0.23,1,0.32,1) ${100 + 3 * 120 + LINK_GROUPS.length * 50}ms`,
            }}
          >
            <ConnectButton />
            <BuyGaffer variant="compact" />
            <div className="flex items-center gap-5 font-mono text-[10px] tracking-[0.22em] uppercase text-white/40">
              <div className="flex items-center gap-3">
                <SoundToggle />
                <span>Sound</span>
              </div>
              <div className="flex items-center gap-2">
                <XLink size={14} />
                <span>Follow</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
