import { parseUnits, formatUnits, type Address } from "viem";

// ─── USDC config ──────────────────────────────────────────────────────────────
// USDC has 6 decimals (not 18 like ETH). All on-chain payment amounts use this.
export const USDC_DECIMALS = 6;

// Circle USDC on Base Sepolia by default; override per-network via env.
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as Address;

// Convert a human string ("1.5") → USDC base units (1500000n).
export function toUSDC(amount: string | number): bigint {
  return parseUnits(String(amount), USDC_DECIMALS);
}

// Convert USDC base units → a JS number for display.
export function fromUSDC(value: bigint): number {
  return Number(formatUnits(value, USDC_DECIMALS));
}

// ─── Minimal ERC-20 ABI (approval flow + balances) ─────────────────────────────
export const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/**
 * Ensure `owner` has approved at least `amount` USDC to `spender`.
 * Sends an approve tx and waits for it only when the current allowance is short.
 *
 * @param publicClient  wagmi/viem public client (reads + waitForTransactionReceipt)
 * @param approveAsync  writeContractAsync from a dedicated useWriteContract() hook
 */
export async function ensureUsdcAllowance(
  publicClient: any,
  approveAsync: (args: any) => Promise<`0x${string}`>,
  owner: Address,
  spender: Address,
  amount: bigint,
): Promise<void> {
  const current = (await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;

  if (current >= amount) return;

  const hash = await approveAsync({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "approve",
    args: [spender, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}
