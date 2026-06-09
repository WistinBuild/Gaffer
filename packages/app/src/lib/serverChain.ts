/**
 * Server-only helper — viem clients backed by the TREASURY_PRIVATE_KEY env var.
 * Used by /api/bot/* routes to act as the bot opponent / oracle owner.
 *
 * NEVER import this from a client component.
 */
import { createPublicClient, createWalletClient, defineChain, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  CONTRACT_ADDRESSES,
  SQUAD_WARS_ABI,
  GAFFER_NFT_ABI,
  ORACLE_ABI,
} from "@/lib/contracts";
import { USDC_ADDRESS, USDC_ABI } from "@/lib/usdc";

// ─── Base Sepolia ──────────────────────────────────────────────────────────
export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia.base.org"] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
});

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
  return createPublicClient({ chain: baseSepolia, transport: http() });
}

export function getBotWallet() {
  return createWalletClient({
    account: getBotAccount(),
    chain: baseSepolia,
    transport: http(),
  });
}

export { CONTRACT_ADDRESSES, SQUAD_WARS_ABI, GAFFER_NFT_ABI, ORACLE_ABI, USDC_ADDRESS, USDC_ABI };

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
