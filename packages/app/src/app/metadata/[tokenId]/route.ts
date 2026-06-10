/**
 * GET /metadata/:tokenId  — ERC-721 metadata for a Gaffer squad card (GafferNFT).
 * The contract's tokenURI = baseURI + tokenId, so set GafferNFT baseURI to
 * `https://<domain>/metadata/`.  Dynamic: reflects live on-chain stats/rarity.
 */
import { NextResponse } from "next/server";
import { CONTRACT_ADDRESSES, GAFFER_NFT_ABI } from "@/lib/contracts";
import { buildSquadMetadata, type SquadCard } from "@/lib/cardMetadata";
import { readTokenContract, metadataErrorResponse } from "@/lib/tokenRead";

export const runtime = "nodejs";
export const revalidate = 60; // cache 60s — stats only change on war resolve

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  const { tokenId } = params;
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: "Invalid token id" }, { status: 400 });
  }
  try {
    const card = await readTokenContract<{
      playerId: string;
      position: number;
      rarity: number;
      tournamentPts: number;
      goals: number;
      assists: number;
      cleanSheets: number;
    }>({
      address: CONTRACT_ADDRESSES.gafferNFT,
      abi: GAFFER_NFT_ABI,
      functionName: "getCard",
      args: [BigInt(tokenId)],
    });

    const meta = buildSquadMetadata(tokenId, {
      playerId: card.playerId,
      position: Number(card.position),
      rarity: Number(card.rarity),
      tournamentPts: Number(card.tournamentPts),
      goals: Number(card.goals),
      assists: Number(card.assists),
      cleanSheets: Number(card.cleanSheets),
    } satisfies SquadCard);

    return NextResponse.json(meta, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    // genuine revert → 404; transient RPC error → 503 (uncached)
    return metadataErrorResponse(e);
  }
}
