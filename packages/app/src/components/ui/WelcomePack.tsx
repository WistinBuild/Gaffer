"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import playersData from "@/data/players.json";
import { Player } from "@/types";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { playCoin, playLevelUp, playSuccess, playWhistle, unlockAudio } from "@/lib/sounds";
import { pickRandomStarterFive, setStarterIds, getStarterIds, type Rarity } from "@/lib/userRoster";

const players = playersData as Player[];

function pickStarterFive() {
  return pickRandomStarterFive(players);
}

const STORAGE_PREFIX = "gaffer_pack_claimed_";

function rarityForRating(rating: number): Rarity {
  return rating >= 75 ? "SILVER" : "BRONZE";
}

export function WelcomePack() {
  const { address, isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<{ player: Player; rarity: Rarity }[]>([]);

  // Grant the starter pack if unclaimed; otherwise re-show the SAME five (no
  // reroll). Used both for the silent first-connect auto-open and manual reopen.
  function openPack(addressLower: string) {
    const key = STORAGE_PREFIX + addressLower;
    const claimed = localStorage.getItem(key);
    if (claimed) {
      const ids = getStarterIds(addressLower);
      const existing = ids
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => !!p)
        .map((p) => ({ player: p, rarity: rarityForRating(p.rating) }));
      if (existing.length) {
        setCards(existing);
        setOpen(true);
        return;
      }
      // claimed flag set but no saved players (edge) — fall through and grant.
    }
    const picked = pickStarterFive();
    setCards(picked);
    setOpen(true);
    setStarterIds(addressLower, picked.map((c) => c.player.id));
    localStorage.setItem(key, String(Date.now()));
  }

  // Silent first-time grant on connect.
  useEffect(() => {
    if (!isConnected || !address || typeof window === "undefined") return;
    const key = STORAGE_PREFIX + address.toLowerCase();
    if (localStorage.getItem(key)) return;
    openPack(address.toLowerCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  // Manual reopen: navigated to /play?pack=open, or window event / debug call.
  useEffect(() => {
    if (typeof window === "undefined" || !address) return;
    const addressLower = address.toLowerCase();
    const trigger = () => {
      openPack(addressLower);
      // Drop the query param so a refresh doesn't reopen it.
      if (new URLSearchParams(window.location.search).get("pack") === "open") {
        const url = new URL(window.location.href);
        url.searchParams.delete("pack");
        window.history.replaceState({}, "", url.toString());
      }
    };
    if (new URLSearchParams(window.location.search).get("pack") === "open") trigger();
    window.addEventListener("gaffer:open-pack", trigger);
    (window as any).__openStarterPack = trigger;
    return () => window.removeEventListener("gaffer:open-pack", trigger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  if (!open) return null;
  return <PackReveal cards={cards} onClose={() => setOpen(false)} />;
}

// ─── PACK REVEAL ANIMATION ────────────────────────────────────────────────────

type Stage = "sealed" | "shaking" | "burst" | "reveal" | "all-revealed";

function PackReveal({
  cards,
  onClose,
}: {
  cards: { player: Player; rarity: Rarity }[];
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>("sealed");
  const [revealedIdx, setRevealedIdx] = useState<number>(-1);

  // Reveal each card sequentially after burst
  useEffect(() => {
    if (stage !== "reveal") return;
    let i = 0;
    setRevealedIdx(0);
    playCoin();
    const tick = setInterval(() => {
      i++;
      if (i >= cards.length) {
        setRevealedIdx(cards.length - 1);
        clearInterval(tick);
        setTimeout(() => {
          setStage("all-revealed");
          playLevelUp();
        }, 600);
        return;
      }
      setRevealedIdx(i);
      playCoin();
    }, 520);
    return () => clearInterval(tick);
  }, [stage, cards.length]);

  function tear() {
    if (stage !== "sealed") return;
    // Fire-and-forget audio unlock — never block the visual state machine on it
    unlockAudio().catch(() => {});
    playWhistle();
    setStage("shaking");
    setTimeout(() => {
      setStage("burst");
      playSuccess();
    }, 700);
    setTimeout(() => {
      setStage("reveal");
    }, 1200);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome pack"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gaffer-black/95 backdrop-blur-md"
        onClick={stage === "all-revealed" ? onClose : undefined}
        style={{ animation: "pack-bg-in 400ms ease-out forwards" }}
      />
      {/* Radial bloom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, rgba(212,175,55,0.22) 0%, transparent 55%)",
          opacity: stage === "burst" || stage === "reveal" || stage === "all-revealed" ? 1 : 0.4,
          transition: "opacity 600ms ease-out",
        }}
      />

      {/* Confetti particles after burst */}
      {(stage === "reveal" || stage === "all-revealed") && <Confetti />}

      <div className="relative max-w-5xl w-full px-6 py-10 text-center">
        {/* Header */}
        <div
          className="font-mono text-[10px] tracking-[0.3em] uppercase text-gaffer-electric mb-3"
          style={{ animation: "pack-fade-in 400ms ease-out" }}
        >
          ● WELCOME GIFT · NEW MANAGER ●
        </div>
        <h2
          className="font-display text-white text-5xl sm:text-7xl tracking-[0.06em] mb-12"
          style={{ animation: "pack-fade-in 400ms ease-out 100ms backwards" }}
        >
          {stage === "all-revealed" ? (
            <span className="text-gaffer-gold">YOUR FIVE</span>
          ) : stage === "sealed" || stage === "shaking" ? (
            "STARTER PACK"
          ) : (
            <span className="text-gaffer-electric">UNSEALING…</span>
          )}
        </h2>

        {/* STAGE: sealed / shaking / burst — show pack */}
        {(stage === "sealed" || stage === "shaking" || stage === "burst") && (
          <div className="flex flex-col items-center gap-8">
            <button
              type="button"
              onClick={tear}
              disabled={stage !== "sealed"}
              aria-label="Open pack"
              className={`relative h-[360px] w-[260px] sm:h-[420px] sm:w-[300px] rounded-3xl ${
                stage === "shaking" ? "pack-shake" : stage === "burst" ? "pack-burst" : "hover:scale-[1.02]"
              } transition-transform duration-200 ease-out-strong active:scale-95 cursor-pointer disabled:cursor-default`}
              style={{
                background:
                  "linear-gradient(135deg, #2A1F08 0%, #6E5210 30%, #D4AF37 50%, #6E5210 70%, #2A1F08 100%)",
                boxShadow:
                  "0 30px 80px -20px rgba(212,175,55,0.55), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -3px 0 rgba(0,0,0,0.4)",
              }}
            >
              {/* Foil shimmer */}
              <span
                className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden"
                style={{
                  background:
                    "linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.35) 50%, transparent 62%)",
                  backgroundSize: "200% 100%",
                  animation: "pack-shimmer 2.4s linear infinite",
                  mixBlendMode: "overlay",
                }}
              />
              {/* Inner panel */}
              <div className="absolute inset-3 rounded-2xl border border-gaffer-black/40 flex flex-col items-center justify-between py-6 px-4 bg-gradient-to-b from-black/10 via-transparent to-black/30">
                <div className="font-mono text-[10px] tracking-[0.3em] text-gaffer-black/80 uppercase">GAFFER · WC26</div>
                <div className="flex flex-col items-center gap-3">
                  <img
                    src="/logo.svg"
                    alt="GAFFER"
                    className="h-24 w-24 rounded-xl object-cover ring-2 ring-gaffer-black/30"
                    draggable={false}
                  />
                  <div className="font-display text-gaffer-black text-3xl sm:text-4xl tracking-[0.18em] leading-none">
                    STARTER PACK
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-gaffer-black/20 px-3 py-1 font-mono text-[9px] tracking-[0.22em] text-gaffer-black/90 uppercase">
                    ★ 5 PLAYERS · FREE ★
                  </div>
                </div>
                <div className="font-mono text-[9px] tracking-[0.28em] text-gaffer-black/70 uppercase">BRONZE · SILVER</div>
              </div>
            </button>
            <div
              className={`font-mono text-[11px] tracking-[0.28em] uppercase text-white/65 ${
                stage === "sealed" ? "animate-pulse" : "opacity-0"
              }`}
            >
              ▼ Tap pack to unseal ▼
            </div>
          </div>
        )}

        {/* STAGE: reveal / all-revealed — show fanned cards */}
        {(stage === "reveal" || stage === "all-revealed") && (
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 mt-2">
            {cards.map((c, i) => {
              const isRevealed = i <= revealedIdx;
              const rot = [-10, -5, 0, 5, 10][i] ?? 0;
              return (
                <div
                  key={c.player.id}
                  className={isRevealed ? "card-pop" : ""}
                  style={{
                    transform: isRevealed
                      ? `rotate(${rot}deg) translateY(0) scale(1)`
                      : `rotate(${rot}deg) translateY(40px) scale(0.85)`,
                    opacity: isRevealed ? 1 : 0,
                    transition:
                      "transform 480ms cubic-bezier(0.22, 1.2, 0.36, 1), opacity 300ms ease-out",
                    transitionDelay: `${i * 60}ms`,
                  }}
                >
                  <PlayerCard
                    player={c.player}
                    rarity={c.rarity}
                    size="sm"
                    tilt={false}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Footer CTA — appears after all revealed */}
        {stage === "all-revealed" && (
          <div className="mt-12 flex flex-col items-center gap-4" style={{ animation: "pack-fade-in 500ms ease-out forwards" }}>
            <p className="text-white/70 max-w-md text-sm">
              These five are in your gaffer. Head to your squad to set them up for matchday.
            </p>
            <button
              onClick={onClose}
              className="group inline-flex items-center gap-3 rounded-full bg-gaffer-electric pl-7 pr-2 py-3 text-gaffer-black hover:brightness-110 active:scale-[0.97] transition-transform duration-150 ease-out-strong animate-hot-edge"
            >
              <span className="font-display text-xl tracking-wider">CONTINUE</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gaffer-black/15">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
            <p className="mt-2 font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase text-center max-w-sm">
              ★ Starter pack is free — one per wallet. Future packs require an on-chain mint via the marketplace.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pack-bg-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pack-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pack-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        :global(.pack-shake) {
          animation: pack-shake 0.7s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes pack-shake {
          0%, 100% { transform: translateX(0) rotate(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px) rotate(-1.5deg); }
          20%, 40%, 60%, 80%      { transform: translateX(6px)  rotate(1.5deg); }
        }
        :global(.pack-burst) {
          animation: pack-burst 0.6s cubic-bezier(0.22, 1.2, 0.36, 1) forwards;
        }
        @keyframes pack-burst {
          0%   { transform: scale(1) rotate(0); opacity: 1; filter: brightness(1); }
          40%  { transform: scale(1.18) rotate(2deg); opacity: 0.9; filter: brightness(1.6); }
          100% { transform: scale(1.6) rotate(-3deg); opacity: 0; filter: brightness(2.4); }
        }
        :global(.card-pop) {
          animation: card-pop 360ms cubic-bezier(0.22, 1.2, 0.36, 1);
        }
        @keyframes card-pop {
          0%   { transform: scale(0.7); }
          60%  { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        i,
        x: (i * 137.5) % 100,
        delay: (i % 6) * 0.15,
        dur: 2.2 + (i % 4) * 0.4,
        color: ["#D4AF37", "#22C58D", "#FFFFFF", "#F5D26C"][i % 4],
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.i}
          className="absolute h-2 w-2 rounded-sm"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            background: p.color,
            animation: `confetti-fall ${p.dur}s linear ${p.delay}s forwards`,
            boxShadow: `0 0 6px ${p.color}80`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-10vh) rotate(0); opacity: 1; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
