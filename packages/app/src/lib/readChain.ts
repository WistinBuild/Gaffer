/**
 * Read-only on-chain client — safe to use from any server route (no private key).
 *
 * RPC precedence: RPC_URL (server-only, may embed a provider API key) →
 * NEXT_PUBLIC_RPC_URL (back-compat) → public Base Sepolia.
 *
 * Prefer the non-public RPC_URL: this module is server-only, so a keyed
 * provider URL must NOT carry the NEXT_PUBLIC_ prefix or it could be inlined
 * into the client bundle. Set a paid provider (ZAN/Alchemy/QuickNode) in
 * production; the public endpoint is rate-limited and flaky under load.
 */
import { createPublicClient, defineChain, http } from "viem";

const RPC_URL =
  process.env.RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
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
