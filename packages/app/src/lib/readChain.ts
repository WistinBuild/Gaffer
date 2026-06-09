/**
 * Read-only on-chain client — safe to use from any server route (no private key).
 *
 * RPC precedence: NEXT_PUBLIC_RPC_URL (or RPC_URL) → public Base Sepolia.
 * Set a paid provider (Alchemy/QuickNode) in production; the public endpoint
 * is rate-limited and flaky under load.
 */
import { createPublicClient, defineChain, http } from "viem";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  "https://sepolia.base.org";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "84532");

export const chain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 8453 ? "Base" : "Base Sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: {
      name: "BaseScan",
      url: CHAIN_ID === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org",
    },
  },
});

let _client: ReturnType<typeof createPublicClient> | null = null;

export function getPublicClient() {
  if (!_client) {
    _client = createPublicClient({ chain, transport: http(RPC_URL) });
  }
  return _client;
}
