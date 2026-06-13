/**
 * $GAFFER token — Solana SPL mint. Shared by the footer token bar.
 */
export const GAFFER_TOKEN = {
  symbol: "$GAFFER",
  /** Mint address (CA) of the $GAFFER token on Solana. */
  address: "6ssLUfyabeUijTH3W39dFoiSEwE8zKc1xryCd6nKVory",
} as const;

/** Short form for compact UI: 6ssLUf…Vory */
export const shortCA = (addr: string = GAFFER_TOKEN.address) =>
  `${addr.slice(0, 6)}…${addr.slice(-4)}`;
