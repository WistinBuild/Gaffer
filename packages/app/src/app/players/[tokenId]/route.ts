/**
 * GET /players/:tokenId — ERC-721 metadata for a marketplace player card (PlayerMint).
 * Set PlayerMint baseURI to `https://<domain>/players/`.
 */
import { NextResponse } from "next/server";
import { buildPlayerMetadata, type PlayerToken } from "@/lib/cardMetadata";
import { readPlayerToken } from "@/lib/solanaServerRead";

export const runtime = "nodejs";
export const revalidate = 300; // player cards are immutable once minted

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  const { tokenId } = params;
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: "Invalid token id" }, { status: 400 });
  }
  try {
    const info = await readPlayerToken(BigInt(tokenId));
    if (!info) {
      return NextResponse.json({ error: "Token does not exist" }, { status: 404 });
    }

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
  } catch {
    return NextResponse.json(
      { error: "Upstream RPC unavailable, retry shortly" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
