/**
 * Server-only Solana reads for the NFT metadata / card-image routes.
 * Uses a plain Connection (no wallet) against the devnet RPC. NEVER imports
 * React. Mirrors the old viem `readTokenContract` but for the Solana programs.
 */
import { Connection } from "@solana/web3.js";
import { playerTokenPda, decodePlayerToken, type PlayerTokenInfo } from "@/lib/gafferPrograms";

const RPC =
  process.env.SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";

let _conn: Connection | null = null;
export function getServerConnection(): Connection {
  if (!_conn) _conn = new Connection(RPC, "confirmed");
  return _conn;
}

/** Read a minted PlayerMint token's metadata by global token id. null = absent. */
export async function readPlayerToken(tokenId: bigint): Promise<PlayerTokenInfo | null> {
  const info = await getServerConnection().getAccountInfo(playerTokenPda(tokenId));
  return info ? decodePlayerToken(info.data) : null;
}
