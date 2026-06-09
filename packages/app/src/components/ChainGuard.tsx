"use client";

import { useEffect, useRef } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { activeChain } from "@/lib/chains";

/**
 * Auto-switch the connected wallet to the app's chain (Base Sepolia by default).
 * Runs whenever a wallet connects on the wrong network. Attempts the switch once
 * per (chainId) so a user who rejects the prompt isn't nagged in a loop.
 */
export function ChainGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const attemptedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!isConnected || chainId === undefined) {
      attemptedFor.current = null;
      return;
    }
    if (chainId === activeChain.id) {
      attemptedFor.current = null;
      return;
    }
    if (attemptedFor.current === chainId) return; // already prompted for this chain
    attemptedFor.current = chainId;
    switchChain({ chainId: activeChain.id });
  }, [isConnected, chainId, switchChain]);

  return null;
}
