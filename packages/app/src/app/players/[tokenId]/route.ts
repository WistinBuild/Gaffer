/**
 * GET /players/:tokenId — ERC-721 metadata for a marketplace player card (PlayerMint).
 * Set PlayerMint baseURI to `https://<domain>/players/`.
 */
import { NextResponse } from "next/server";
import { CONTRACT_ADDRESSES, PLAYER_MINT_ABI } from "@/lib/contracts";
import { buildPlayerMetadata, type PlayerToken } from "@/lib/cardMetadata";
import { readTokenContract, metadataErrorResponse } from "@/lib/tokenRead";

export const runtime = "nodejs";
export const revalidate = 300; // player cards are immutable once minted

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  const { tokenId } = params;
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: "Invalid token id" }, { status: 400 });
  }
  try {
    const info = await readTokenContract<{
      playerId: string;
      position: number;
      rating: number;
      isLegend: boolean;
      mintedAt: number;
    }>({
      address: CONTRACT_ADDRESSES.playerMint,
      abi: PLAYER_MINT_ABI,
      functionName: "tokenInfo",
      args: [BigInt(tokenId)],
    });

    const meta = buildPlayerMetadata(tokenId, {
      playerId: info.playerId,
      position: Number(info.position),
      rating: Number(info.rating),
      isLegend: Boolean(info.isLegend),
      mintedAt: Number(info.mintedAt),
    } satisfies PlayerToken);

    return NextResponse.json(meta, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    return metadataErrorResponse(e);
  }
}
