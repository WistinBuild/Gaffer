"use client";

import { useEffect, useRef } from "react";

type Overlay = "soft" | "strong" | "hero" | "radial" | "none";

interface VideoBackdropProps {
  src: string;
  /** 0..1 video opacity (after blend) */
  opacity?: number;
  blur?: number;
  blend?: "normal" | "luminosity" | "screen" | "overlay" | "soft-light" | "multiply";
  overlay?: Overlay;
  /** Optional poster image while video buffers */
  poster?: string;
  /** Slow the video for atmospheric feel; defaults 0.6 */
  playbackRate?: number;
  className?: string;
}

const OVERLAYS: Record<Overlay, string> = {
  soft: "bg-gradient-to-b from-gaffer-black/40 via-gaffer-black/65 to-gaffer-black",
  strong: "bg-gradient-to-b from-gaffer-black/70 via-gaffer-black/85 to-gaffer-black",
  hero:
    "bg-[radial-gradient(ellipse_70%_55%_at_50%_45%,transparent_0%,rgba(8,11,15,0.55)_55%,rgba(8,11,15,1)_100%)]",
  radial:
    "bg-[radial-gradient(ellipse_60%_45%_at_50%_50%,transparent_0%,rgba(8,11,15,0.7)_60%,rgba(8,11,15,0.95)_100%)]",
  none: "",
};

/**
 * Full-section video background. Fixed-position child wrapped in heavy
 * gradient + blend treatment so foreground text stays crisp.
 *
 * Performance: muted + playsInline + low playbackRate. Mobile may not
 * autoplay; fallback poster shows in that case.
 */
export function VideoBackdrop({
  src,
  opacity = 0.55,
  blur = 0,
  blend = "luminosity",
  overlay = "hero",
  poster,
  playbackRate = 0.6,
  className = "",
}: VideoBackdropProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = playbackRate;
    // Best-effort autoplay
    v.play().catch(() => {});
  }, [playbackRate]);

  return (
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden pointer-events-none -z-10 ${className}`}
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
          mixBlendMode: blend,
        }}
      />
      {overlay !== "none" && <div className={`absolute inset-0 ${OVERLAYS[overlay]}`} />}
    </div>
  );
}
