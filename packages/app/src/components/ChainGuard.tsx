"use client";

/**
 * No-op on Solana. The EVM build auto-switched the wallet to the app's chain;
 * Solana has no per-app chain to enforce, so this guard does nothing. Kept as a
 * component so Providers.tsx's tree is unchanged during the migration.
 */
export function ChainGuard() {
  return null;
}
