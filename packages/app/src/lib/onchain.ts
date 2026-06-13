"use client";

import { useQuery } from "@tanstack/react-query";
import { useGaffer } from "@/lib/useGaffer";
import * as G from "@/lib/gafferPrograms";
export type { ChainWar } from "@/lib/gafferPrograms";

// The Solana programs are always configured (program IDs ship as defaults), so
// the old "are the EVM addresses set?" gate is now always true.
export const hasContracts = true;

/** Read every existing war from the SquadWars program. */
export function useAllWars() {
  const { conn } = useGaffer();
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["allWars"],
    queryFn: () => G.getAllWars(conn),
    refetchInterval: 15_000,
  });
  return { wars: data ?? [], refetch, isLoading };
}

export interface LeaderRow {
  manager: string;
  wins: number;
}

/** Read the on-chain leaderboard (top `limit` by wins). */
export function useLeaderboard(limit = 10) {
  const { conn } = useGaffer();
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", limit],
    queryFn: () => G.getLeaderboard(conn, limit),
  });
  const rows: LeaderRow[] = (data ?? []).map((r) => ({ manager: r.manager, wins: r.wins }));
  return { rows, isLoading };
}

export { shortAddr } from "@/lib/gafferPrograms";
