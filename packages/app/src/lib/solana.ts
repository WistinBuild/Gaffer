import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";
import { solanaDevnet } from "@reown/appkit/networks";
import { Connection, clusterApiUrl } from "@solana/web3.js";

/**
 * Solana devnet configuration.
 *
 * The app is migrating its on-chain layer from Base (EVM) to Solana devnet.
 * This module owns the devnet network/wallet config; the EVM contract reads in
 * `lib/onchain.ts` / `lib/contracts.ts` stay in place but are pending a rewrite
 * to Anchor programs (see SECURITY/migration notes). Nothing here touches the
 * Solidity contracts.
 */

export const SOLANA_CLUSTER = "devnet" as const;

// Override with NEXT_PUBLIC_SOLANA_RPC_URL (e.g. a Helius/Triton devnet URL) to
// avoid the public faucet RPC's aggressive rate limits.
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(SOLANA_CLUSTER);

export const SOLANA_EXPLORER = "https://explorer.solana.com";

/** Explorer link for an address on the active (devnet) cluster. */
export const solanaExplorerAddress = (address: string) =>
  `${SOLANA_EXPLORER}/address/${address}?cluster=${SOLANA_CLUSTER}`;

/** Explorer link for a transaction signature on the active cluster. */
export const solanaExplorerTx = (signature: string) =>
  `${SOLANA_EXPLORER}/tx/${signature}?cluster=${SOLANA_CLUSTER}`;

/** Read-only devnet connection (balances, account reads). */
export const getSolanaConnection = () =>
  new Connection(SOLANA_RPC_URL, "confirmed");

/** Reown AppKit Solana adapter — wires wallet-adapter into the connect modal. */
export const solanaAdapter = new SolanaAdapter();

/** Solana networks exposed in the connect modal. Devnet only for now. */
export const solanaNetworks = [solanaDevnet] as const;

/** Default target network for the connect modal: Solana devnet. */
export const solanaDefaultNetwork = solanaDevnet;
