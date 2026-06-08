"use client";

import { CSSProperties } from "react";

type Overlay = "soft" | "strong" | "hero" | "radial" | "none";

interface BackdropProps {
  src: string;
  opacity?: number; // 0..1
  blur?: number; // px
  overlay?: Overlay;
  blend?: "normal" | "luminosity" | "screen" | "overlay" | "soft-light" | "multiply";
  position?: string; // background-position
  scale?: number; // visual scale (slight zoom for parallax feel)
  className?: string;
}

const OVERLAYS: Record<Overlay, string> = {
  soft: "bg-gradient-to-b from-gaffer-black/40 via-gaffer-black/65 to-gaffer-black",
  strong: "bg-gradient-to-b from-gaffer-black/70 via-gaffer-black/85 to-gaffer-black",
  hero:
    "bg-[radial-gradient(ellipse_70%_50%_at_50%_40%,transparent_0%,rgba(8,11,15,0.55)_55%,rgba(8,11,15,1)_100%)]",
  radial:
    "bg-[radial-gradient(ellipse_60%_45%_at_50%_50%,transparent_0%,rgba(8,11,15,0.7)_60%,rgba(8,11,15,0.95)_100%)]",
  none: "",
};

/**
 * Cinematic ambient backdrop. Place inside a `relative` section.
 * Heavily treated: opacity + blur + blend + dark gradient overlay so the
 * underlying image becomes atmosphere, never foreground noise.
 */
export function Backdrop({
  src,
  opacity = 0.25,
  blur = 0,
  overlay = "hero",
  blend = "luminosity",
  position = "center",
  scale = 1,
  className = "",
}: BackdropProps) {
  const imgStyle: CSSProperties = {
    backgroundImage: `url(${src})`,
    backgroundPosition: position,
    opacity,
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
    mixBlendMode: blend,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: "center",
  };

  return (
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden pointer-events-none -z-10 ${className}`}
    >
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={imgStyle}
      />
      {overlay !== "none" && (
        <div className={`absolute inset-0 ${OVERLAYS[overlay]}`} />
      )}
    </div>
  );
}

// FOOTBALL_IMAGERY lives in `@/lib/imagery` so Server Components can read it
// without crossing the client/server boundary. Import from there.
export { FOOTBALL_IMAGERY } from "@/lib/imagery";
