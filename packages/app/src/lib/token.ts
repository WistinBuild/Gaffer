/**
 * $GAFFER token — live on mainnet.
 * Shared by the navbar, hero token bar, and footer.
 */
export const GAFFER_TOKEN = {
  symbol: "$GAFFER",
  /** Contract address (CA) of the $GAFFER token. */
  address: "0x8259F905B85CCF6d946e60B3d19cc587EF8B2bA3",
} as const;

/** Short form for compact UI: 0x8259…2bA3 */
export const shortCA = (addr: string = GAFFER_TOKEN.address) =>
  `${addr.slice(0, 6)}…${addr.slice(-4)}`;
