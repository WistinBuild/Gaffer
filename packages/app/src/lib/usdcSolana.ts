/**
 * USDC helpers for the Solana on-chain layer. USDC is an SPL token with 6
 * decimals; amounts are bigint base units. Unlike ERC-20 there is no
 * approve/allowance step — SPL transfers are authorized by the owner signing
 * the transaction, so the program pulls USDC directly from the payer's ATA.
 */
export const USDC_DECIMALS = 6;

/** Human string/number ("1.5") → USDC base units (1_500_000n). */
export function toUSDC(amount: string | number): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  const fracPadded = (frac + "000000").slice(0, USDC_DECIMALS);
  return BigInt(whole || "0") * BigInt(1_000_000) + BigInt(fracPadded || "0");
}

/** USDC base units → a JS number for display. */
export function fromUSDC(value: bigint): number {
  return Number(value) / 10 ** USDC_DECIMALS;
}
