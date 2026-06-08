"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen loading splash that fires immediately when the user hits ENTER
 * THE PITCH and persists until the destination page mounts. Driven by two
 * window events:
 *   gaffer:splash-show — show the floating logo
 *   gaffer:splash-clear — destination page rendered; fade out
 *
 * The CSS animation runs immediately on mount, so the user sees motion within
 * one frame of clicking the button — masking the Next.js compile / hydration
 * delay (which can be 5–15s on a cold dev server or first prod hit).
 */
export function PitchSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onShow = () => { setFading(false); setVisible(true); };
    const onClear = () => {
      setFading(true);
      setTimeout(() => setVisible(false), 480);
    };
    window.addEventListener("gaffer:splash-show", onShow);
    window.addEventListener("gaffer:splash-clear", onClear);
    // Failsafe — if the destination never fires clear (network failure, etc),
    // auto-clear after 30s so the user is never permanently stuck.
    let killTimer: NodeJS.Timeout | null = null;
    const arm = () => {
      if (killTimer) clearTimeout(killTimer);
      killTimer = setTimeout(() => {
        setFading(true);
        setTimeout(() => setVisible(false), 480);
      }, 30_000);
    };
    window.addEventListener("gaffer:splash-show", arm);
    return () => {
      window.removeEventListener("gaffer:splash-show", onShow);
      window.removeEventListener("gaffer:splash-clear", onClear);
      window.removeEventListener("gaffer:splash-show", arm);
      if (killTimer) clearTimeout(killTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label="Loading the pitch"
      style={{
        background:
          "radial-gradient(circle at center, rgba(0,40,28,0.85) 0%, rgba(8,11,15,0.97) 60%, #080B0F 100%)",
        opacity: fading ? 0 : 1,
        transition: "opacity 480ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Soft glow halo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,255,135,0.18) 0%, transparent 50%)",
          animation: "splash-bloom 2.4s ease-in-out infinite",
        }}
      />

      {/* Floating logo */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(0,255,135,0.55) 0%, transparent 70%)",
            transform: "scale(1.4)",
            animation: "splash-pulse 1.8s ease-in-out infinite",
          }}
        />
        <img
          src="/logo.svg"
          alt="GAFFER"
          draggable={false}
          className="relative h-44 w-44 sm:h-56 sm:w-56 rounded-3xl object-cover ring-1 ring-gaffer-electric/30"
          style={{
            animation: "splash-float 3.2s ease-in-out infinite",
            boxShadow:
              "0 20px 60px -10px rgba(0,255,135,0.4), 0 8px 24px rgba(0,0,0,0.55)",
          }}
        />
      </div>

      {/* Caption */}
      <div
        className="relative mt-10 font-display text-white text-3xl sm:text-4xl tracking-[0.18em]"
        style={{
          textShadow: "0 0 30px rgba(0,255,135,0.45)",
          animation: "splash-text 1.6s ease-in-out infinite",
        }}
      >
        ENTERING THE PITCH
      </div>
      <div className="relative mt-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.32em] uppercase text-white/55">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-gaffer-electric animate-live-dot" />
        Loading manager HQ
      </div>

      {/* Bottom progress sliver */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-56 h-[2px] rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gaffer-gold via-gaffer-electric to-gaffer-gold"
          style={{
            width: "40%",
            animation: "splash-progress 1.6s cubic-bezier(0.6,0.0,0.4,1) infinite",
          }}
        />
      </div>

      <style jsx>{`
        @keyframes splash-float {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-10px) scale(1.02); }
        }
        @keyframes splash-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1.3); }
          50%      { opacity: 1;   transform: scale(1.55); }
        }
        @keyframes splash-bloom {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1;   }
        }
        @keyframes splash-text {
          0%, 100% { opacity: 0.75; letter-spacing: 0.18em; }
          50%      { opacity: 1;    letter-spacing: 0.22em; }
        }
        @keyframes splash-progress {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(360%);  }
        }
      `}</style>
    </div>
  );
}
