"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { zeroAddress, type Address } from "viem";
import { CONTRACT_ADDRESSES, SQUAD_WARS_ABI } from "@/lib/contracts";

// Are the contracts configured (env addresses set)?
export const hasContracts = CONTRACT_ADDRESSES.squadWars !== zeroAddress;

// How many war IDs to scan (wars are sequential from 1).
const WAR_SCAN_LIMIT = 40;

export interface ChainWar {
  id: bigint;
  challenger: Address;
  opponent: Address;
  stake: bigint;
  matchday: bigint;
  captainSlot: number;
  benchedSlot: number;
  opponentCaptainSlot: number;
  opponentBenchedSlot: number;
  challengerScore: bigint;
  opponentScore: bigint;
  status: number; // 0=Open 1=Active 2=Resolved 3=Cancelled
  winner: Address;
  decisionLocked: boolean;
}

/** Read every existing war via multicall. Returns [] until contracts are set. */
export function useAllWars() {
  const contracts = useMemo(
    () =>
      Array.from({ length: WAR_SCAN_LIMIT }, (_, i) => ({
        address: CONTRACT_ADDRESSES.squadWars,
        abi: SQUAD_WARS_ABI,
        functionName: "getWar" as const,
        args: [BigInt(i + 1)] as const,
      })),
    [],
  );

  const { data, refetch, isLoading } = useReadContracts({
    contracts,
    query: { enabled: hasContracts },
  });

  const wars = useMemo<ChainWar[]>(() => {
    if (!data) return [];
    return data
      .map((r) => (r.status === "success" ? (r.result as unknown as ChainWar) : null))
      .filter((w): w is ChainWar => w !== null && w.challenger !== zeroAddress);
  }, [data]);

  return { wars, refetch, isLoading: hasContracts && isLoading };
}

export interface LeaderRow {
  manager: Address;
  wins: number;
}

/** Read the on-chain leaderboard (top `limit` by wins). */
export function useLeaderboard(limit = 10) {
  const { data, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.squadWars,
    abi: SQUAD_WARS_ABI,
    functionName: "getLeaderboard",
    args: [BigInt(limit)],
    query: { enabled: hasContracts },
  });

  const rows = useMemo<LeaderRow[]>(() => {
    if (!data) return [];
    const [managers, winCounts] = data as unknown as [Address[], bigint[]];
    return managers
      .map((m, i) => ({ manager: m, wins: Number(winCounts[i]) }))
      .filter((r) => r.manager !== zeroAddress);
  }, [data]);

  return { rows, isLoading: hasContracts && isLoading };
}

export function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
