"use client";

/**
 * React glue for the Gaffer Solana programs. Wraps Reown AppKit's Solana
 * connection + wallet provider and the pure SDK in `lib/gafferPrograms.ts`.
 *
 * Replaces the wagmi read/write hooks. Reads use @tanstack/react-query (already
 * in the app); writes go through AppKit's Solana provider (`sendTransaction`).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { useAppKitConnection } from "@reown/appkit-adapter-solana/react";
import { Connection, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { getSolanaConnection } from "@/lib/solana";
import * as G from "@/lib/gafferPrograms";

/** Active Solana wallet address (base58) + connection, from AppKit. */
export function useGaffer() {
  const { address, isConnected } = useAppKitAccount();
  const { connection } = useAppKitConnection();
  const conn = (connection as Connection | undefined) || getSolanaConnection();

  const pubkey = useMemo(() => {
    if (!address) return undefined;
    try {
      return new PublicKey(address);
    } catch {
      return undefined; // address belongs to a non-Solana network
    }
  }, [address]);

  return { address, pubkey, isConnected: isConnected && !!pubkey, conn };
}

/** Send one or more instructions as a single transaction via the wallet. */
export function useGafferSend() {
  const { walletProvider } = useAppKitProvider<any>("solana");
  const { pubkey, conn } = useGaffer();

  return async function send(ixs: TransactionInstruction[]): Promise<string> {
    if (!walletProvider) throw new Error("No Solana wallet connected");
    if (!pubkey) throw new Error("Connect a Solana wallet (devnet)");
    const tx = new Transaction().add(...ixs);
    tx.feePayer = pubkey;
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    const sig = await walletProvider.sendTransaction(tx, conn);
    await conn.confirmTransaction(sig, "confirmed");
    return sig;
  };
}

// ─── read hooks ───────────────────────────────────────────────────────────────
export function useHasMinted(owner?: PublicKey) {
  const { conn } = useGaffer();
  return useQuery({
    queryKey: ["hasMinted", owner?.toBase58()],
    enabled: !!owner,
    queryFn: () => G.hasMintedSquad(conn, owner!),
  });
}

export function useSquadCards(owner?: PublicKey) {
  const { conn } = useGaffer();
  return useQuery({
    queryKey: ["squadCards", owner?.toBase58()],
    enabled: !!owner,
    queryFn: () => G.getSquadCards(conn, owner!),
  });
}

export function useManagerRecord(owner?: PublicKey) {
  const { conn } = useGaffer();
  return useQuery({
    queryKey: ["managerRecord", owner?.toBase58()],
    enabled: !!owner,
    queryFn: () => G.getManagerStats(conn, owner!),
  });
}

export function useWar(warId?: bigint | number) {
  const { conn } = useGaffer();
  return useQuery({
    queryKey: ["war", String(warId ?? "")],
    enabled: warId !== undefined,
    queryFn: () => G.getWar(conn, warId!),
  });
}

export function useCatalogBatch(playerIds: string[]) {
  const { conn } = useGaffer();
  return useQuery({
    queryKey: ["catalogBatch", playerIds.join(",")],
    enabled: playerIds.length > 0,
    refetchInterval: 20_000,
    queryFn: () => G.getCatalogBatch(conn, playerIds),
  });
}

export function usePlayerTokens(owner?: PublicKey) {
  const { conn } = useGaffer();
  return useQuery({
    queryKey: ["playerTokens", owner?.toBase58()],
    enabled: !!owner,
    queryFn: () => G.getPlayerTokensOf(conn, owner!),
  });
}
