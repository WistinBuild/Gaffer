"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { useState } from "react";
import { activeChain } from "@/lib/chains";

function truncate(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: bal } = useBalance({ address, chainId: activeChain.id });
  const [open, setOpen] = useState(false);

  if (!isConnected) {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    return (
      <button
        onClick={() => injected && connect({ connector: injected })}
        disabled={isPending}
        className="group relative inline-flex items-center gap-2 rounded-full
          bg-gaffer-gold px-2 py-2 pl-5 text-gaffer-black
          transition-transform duration-150 ease-out-strong active:scale-[0.97]
          hover:bg-gaffer-gold-light disabled:opacity-60"
      >
        <span className="font-semibold text-sm tracking-tight">
          {isPending ? "Connecting…" : "Connect Wallet"}
        </span>
        {/* Button-in-button trailing icon */}
        <span
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gaffer-black/15
            transition-transform duration-200 ease-out-strong
            group-hover:translate-x-0.5 group-hover:-translate-y-[1px]"
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
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex items-center gap-2 rounded-full pl-2 pr-1.5 py-1.5
          bg-white/5 hairline transition-transform duration-150 ease-out-strong active:scale-[0.97]
          hover:bg-white/10"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gaffer-electric/15 ring-1 ring-gaffer-electric/40">
          <span className="h-2 w-2 rounded-full bg-gaffer-electric shadow-[0_0_8px_rgba(34, 197, 141,0.8)]" />
        </span>
        <span className="font-mono text-xs tracking-tight text-white/90">
          {truncate(address)}
        </span>
        {bal && (
          <span className="hidden sm:inline font-mono text-[11px] text-white/50 px-2 border-l border-white/10">
            {Number(bal.formatted).toFixed(3)} {bal.symbol}
          </span>
        )}
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            className={`transition-transform duration-200 ease-out-strong ${
              open ? "rotate-180" : ""
            }`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-2xl p-1.5
            bg-gaffer-surface/95 backdrop-blur-xl hairline-strong
            shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]
            transition-opacity duration-150 ease-out-strong"
          style={{ transformOrigin: "top right" }}
        >
          <div className="rounded-xl bg-black/40 p-3 mb-1">
            <div className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase mb-1">
              {activeChain.name}
            </div>
            <div className="font-mono text-xs text-white break-all">{address}</div>
          </div>
          <button
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-medium text-white/80
              hover:bg-white/5 transition-colors duration-150"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
