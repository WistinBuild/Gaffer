"use client";

import { useState } from "react";
import { GAFFER_TOKEN, shortCA } from "@/lib/token";

/**
 * $GAFFER token bar — shows the contract address (copy-to-clipboard).
 * Used on the home hero and in the footer.
 *
 * variant="bar"     → full glass strip with label + CA (hero)
 * variant="compact" → just the copyable CA chip (navbar / tight spots)
 */
export function BuyGaffer({
  variant = "bar",
  className = "",
}: {
  variant?: "bar" | "compact";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(GAFFER_TOKEN.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  if (variant === "compact") {
    return <CopyCA copied={copied} copy={copy} className={className} />;
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 rounded-full p-[1.5px]
        bg-gradient-to-r from-gaffer-gold/50 via-white/10 to-gaffer-electric/40 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-full bg-gaffer-black/85 backdrop-blur-md hairline px-2.5 py-2">
        {/* token chip */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gaffer-gold/15 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-gaffer-electric animate-live-dot" />
          <span className="font-display text-sm tracking-wider text-gaffer-gold">
            {GAFFER_TOKEN.symbol}
          </span>
        </span>

        {/* copyable CA */}
        <CopyCA copied={copied} copy={copy} />
      </div>
    </div>
  );
}

function CopyCA({
  copied,
  copy,
  className = "",
}: {
  copied: boolean;
  copy: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy contract address"
      className={`group inline-flex items-center gap-2 rounded-full px-2 py-1
        font-mono text-[11px] tracking-[0.06em] text-white/70 hover:text-white
        transition-colors duration-150 ${className}`}
    >
      <span className="hidden sm:inline">CA</span>
      <span className="tabular-nums">{shortCA()}</span>
      <span
        className={`inline-flex items-center text-[10px] tracking-[0.18em] uppercase
          ${copied ? "text-gaffer-electric" : "text-white/35 group-hover:text-white/60"}`}
      >
        {copied ? "Copied ✓" : "Copy"}
      </span>
    </button>
  );
}
