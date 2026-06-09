"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { playSwoosh, unlockAudio } from "@/lib/sounds";

/**
 * Wraps every page in a bold arrival animation + plays a swoosh sound on route change.
 * Mounts a sweep overlay that wipes left → right across the viewport.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFirstMount = useRef(true);
  const [phase, setPhase] = useState<"idle" | "sweeping">("idle");

  useEffect(() => {
    // Skip animation on first mount (already on the page)
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    // Trigger sweep + swoosh on every subsequent route change
    unlockAudio().then(playSwoosh).catch(() => {});
    setPhase("sweeping");
    const t = setTimeout(() => setPhase("idle"), 700);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <>
      {/* Page-arrival key forces a remount → CSS animation re-fires */}
      <div key={pathname} className="animate-page-in">
        {children}
      </div>

      {/* Sweep overlay */}
      {phase === "sweeping" && (
        <div
          aria-hidden
          className="fixed inset-0 z-[80] pointer-events-none overflow-hidden"
        >
          <div
            className="absolute inset-y-0 -left-1/2 w-1/2"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.05) 30%, rgba(212,175,55,0.45) 50%, rgba(34, 197, 141,0.4) 60%, rgba(212,175,55,0.05) 70%, transparent 100%)",
              animation: "page-sweep 700ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
              filter: "blur(12px)",
            }}
          />
        </div>
      )}
    </>
  );
}
