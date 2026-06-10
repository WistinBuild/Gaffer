/**
 * Server-only helper — viem clients backed by the TREASURY_PRIVATE_KEY env var.
 * Used by /api/bot/* routes to act as the bot opponent / oracle owner.
 *
 * NEVER import this from a client component.
 */
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { activeChain, base, baseSepolia } from "@/lib/chains";
import {
  CONTRACT_ADDRESSES,
  SQUAD_WARS_ABI,
  GAFFER_NFT_ABI,
  ORACLE_ABI,
} from "@/lib/contracts";
import { USDC_ADDRESS, USDC_ABI } from "@/lib/usdc";

export { activeChain, base, baseSepolia };

// Server-only RPC (may embed a provider key). Falls back to the chain default
// (mainnet.base.org / sepolia.base.org) when unset.
const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || undefined;

function getTreasuryKey(): `0x${string}` {
  const raw = process.env.TREASURY_PRIVATE_KEY;
  if (!raw) {
    throw new Error(
      "TREASURY_PRIVATE_KEY env var is missing. Add it in Vercel → Project Settings → Environment Variables.",
    );
  }
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
}

export function getBotAccount() {
  return privateKeyToAccount(getTreasuryKey());
}

export function getPublic() {
  return createPublicClient({ chain: activeChain, transport: http(RPC_URL) });
}

export function getBotWallet() {
  return createWalletClient({
    account: getBotAccount(),
    chain: activeChain,
    transport: http(RPC_URL),
  });
}

export { CONTRACT_ADDRESSES, SQUAD_WARS_ABI, GAFFER_NFT_ABI, ORACLE_ABI, USDC_ADDRESS, USDC_ABI };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send a contract write and wait for its receipt, retrying on transient
 * reverts. The bot fires dependent txs back-to-back (approve→accept→lock,
 * post→resolve); an RPC node can simulate the next tx before the previous one
 * has propagated, surfacing stale-state reverts ("exceeds allowance",
 * "War not active", "Matchday not finalized"). These reverts happen at gas
 * estimation BEFORE broadcast, so re-trying with backoff is safe (no double
 * send) and lets the chain state catch up.
 */
export async function writeWithRetry(
  pub: ReturnType<typeof getPublic>,
  wallet: ReturnType<typeof getBotWallet>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  label: string,
  tries = 6,
): Promise<`0x${string}`> {
  let lastErr: unknown;
  for (let i = 1; i <= tries; i++) {
    try {
      const hash = await wallet.writeContract(params);
      await pub.waitForTransactionReceipt({ hash });
      return hash;
    } catch (err) {
      lastErr = err;
      await sleep(1500 * i);
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`${label} failed after ${tries} attempts: ${msg}`);
}

// ─── Default bot squad (used if the bot hasn't minted yet) ────────────────────
// 5 well-balanced players with valid formation (1 GK, 2 DEF, 1 MID, 1 FWD).
// Positions encoded as: 0=GK, 1=DEF, 2=MID, 3=FWD.
export const BOT_SQUAD_PLAYER_IDS: [string, string, string, string, string] = [
  "courtois",     // GK
  "ruben_dias",   // DEF
  "marquinhos",   // DEF
  "casemiro",     // MID
  "kane",         // FWD (verify exists)
];
export const BOT_SQUAD_POSITIONS: [number, number, number, number, number] = [
  0, 1, 1, 2, 3,
];
