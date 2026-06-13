"use client";

import { useAppKit, useAppKitAccount, useDisconnect } from "@reown/appkit/react";
import { useState } from "react";

const NETWORK_LABEL = "Solana Devnet";

function truncate(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected } = useAppKitAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const [menuOpen, setMenuOpen] = useState(false);

  // ─── Disconnected — open the Reown AppKit modal ───────────────────────────
  if (!isConnected) {
    return (
      <button
        onClick={() => open()}
        className="group relative inline-flex items-center gap-2 rounded-full
          bg-gaffer-gold px-2 py-2 pl-5 text-gaffer-black
          transition-transform duration-150 ease-out-strong active:scale-[0.97]
          hover:bg-gaffer-gold-light"
      >
        <span className="font-semibold text-sm tracking-tight">Connect Wallet</span>
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

  // ─── Connected ────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="group inline-flex items-center gap-2 rounded-full pl-2 pr-1.5 py-1.5
          bg-white/5 hairline transition-transform duration-150 ease-out-strong active:scale-[0.97]
          hover:bg-white/10"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gaffer-electric/15 ring-1 ring-gaffer-electric/40">
          <span className="h-2 w-2 rounded-full bg-gaffer-electric shadow-[0_0_8px_rgba(34,197,141,0.8)]" />
        </span>
        <span className="font-mono text-xs tracking-tight text-white/90">
          {truncate(address)}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            className={`transition-transform duration-200 ease-out-strong ${
              menuOpen ? "rotate-180" : ""
            }`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute right-0 z-50 mt-2 w-64 rounded-2xl p-1.5
              bg-gaffer-surface/95 backdrop-blur-xl hairline-strong
              shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
            style={{ transformOrigin: "top right" }}
          >
            <div className="rounded-xl bg-black/40 p-3 mb-1">
              <div className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase mb-1">
                {NETWORK_LABEL}
              </div>
              <div className="font-mono text-xs text-white break-all">{address}</div>
            </div>
            <button
              onClick={() => {
                open({ view: "Account" });
                setMenuOpen(false);
              }}
              className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-medium text-white/80
                hover:bg-white/5 transition-colors duration-150"
            >
              Wallet &amp; network
            </button>
            <button
              onClick={() => {
                disconnect();
                setMenuOpen(false);
              }}
              className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-medium text-white/80
                hover:bg-white/5 transition-colors duration-150"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
