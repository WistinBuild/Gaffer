"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { playKick, playCrowd, unlockAudio, markPitchEntry } from "@/lib/sounds";

interface Props {
  href?: string;
  children?: React.ReactNode;
  variant?: "primary" | "ghost";
}

export function EnterPitchButton({
  href = "/play",
  children = "ENTER THE PITCH",
  variant = "primary",
}: Props) {
  const router = useRouter();
  const [transitioning, setTransitioning] = useState(false);

  async function handleEnter() {
    if (transitioning) return;

    // Fire splash immediately — within one frame of the click — so the user
    // never sees a "stuck" 5–15s gap while /play compiles / hydrates.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("gaffer:splash-show"));
      sessionStorage.setItem("gaffer_music_active", "1");
      window.dispatchEvent(new Event("gaffer:music-activate"));
    }

    unlockAudio().catch(() => {});
    playKick();
    setTimeout(() => playCrowd(5), 220);

    markPitchEntry();
    setTransitioning(true);

    // Navigate immediately — the splash carries the visual load. PitchSplash
    // listens on /play for a `gaffer:splash-clear` event and fades itself out
    // once the destination has rendered.
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleEnter}
        disabled={transitioning}
        className={
          variant === "primary"
            ? `group relative inline-flex items-center gap-3 rounded-full
                bg-gaffer-gold pl-8 pr-2.5 py-3.5 text-gaffer-black
                transition-transform duration-150 ease-out-strong active:scale-[0.96]
                hover:bg-gaffer-gold-light animate-hot-edge
                disabled:opacity-70`
            : `group inline-flex items-center gap-2 rounded-full
                bg-white/[0.04] hairline px-5 py-3 text-white/85
                transition-transform duration-150 ease-out-strong active:scale-[0.97]
                hover:bg-white/[0.08]`
        }
      >
        <span
          className={
            variant === "primary"
              ? "font-display text-xl tracking-wider"
              : "font-medium text-[14px]"
          }
        >
          {children}
        </span>
        <span
          className={`flex items-center justify-center rounded-full
            transition-transform duration-200 ease-out-strong
            group-hover:translate-x-0.5 group-hover:-translate-y-[1px]
            ${
              variant === "primary"
                ? "h-11 w-11 bg-gaffer-black/15"
                : "h-7 w-7 bg-white/10"
            }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 17L17 7M17 7H8M17 7V16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {/* Old PortalOverlay is now superseded by PitchSplash (mounted at the
          root layout). The splash listens for gaffer:splash-show and survives
          across navigation, then fades when the destination mounts. */}
    </>
  );
}

// ─── Portal overlay — full-screen entrance ────────────────────────────────────

function PortalOverlay() {
  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none"
      style={{
        animation: "portal-fade 1100ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
      }}
    >
      {/* Black wash */}
      <div className="absolute inset-0 bg-gaffer-black opacity-0"
        style={{ animation: "portal-bg 1100ms cubic-bezier(0.23, 1, 0.32, 1) forwards" }} />

      {/* Radial light bloom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(212,175,55,0.4) 0%, transparent 50%)",
          animation: "portal-bloom 1100ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
        }}
      />

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="font-display text-gaffer-gold text-6xl sm:text-7xl tracking-[0.15em]"
          style={{
            textShadow: "0 0 60px rgba(212,175,55,0.8)",
            opacity: 0,
            animation: "portal-text 1100ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
          }}
        >
          KICK OFF
        </div>
        <div
          className="mt-3 font-mono text-[11px] tracking-[0.3em] text-gaffer-electric uppercase"
          style={{
            opacity: 0,
            animation: "portal-text 1100ms cubic-bezier(0.23, 1, 0.32, 1) 300ms forwards",
          }}
        >
          ★ entering the arena ★
        </div>
      </div>

      <style jsx>{`
        @keyframes portal-fade {
          0% { opacity: 0; }
          15% { opacity: 1; }
          100% { opacity: 1; }
        }
        @keyframes portal-bg {
          0% { opacity: 0; }
          25% { opacity: 0.92; }
          100% { opacity: 1; }
        }
        @keyframes portal-bloom {
          0% { transform: scale(0.3); opacity: 0; }
          40% { transform: scale(1); opacity: 0.85; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes portal-text {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          30% { opacity: 1; transform: translateY(0) scale(1); }
          85% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-12px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
