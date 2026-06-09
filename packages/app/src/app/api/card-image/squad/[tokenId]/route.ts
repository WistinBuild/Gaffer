/**
 * GET /api/card-image/squad/:tokenId — SVG art for a GafferNFT squad card.
 */
import { getPublicClient } from "@/lib/readChain";
import { CONTRACT_ADDRESSES, GAFFER_NFT_ABI } from "@/lib/contracts";
import {
  getPlayer,
  renderCardSVG,
  POSITION_NAME,
  RARITY_NAME,
  RARITY_COLOR,
} from "@/lib/cardMetadata";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  const { tokenId } = params;
  if (!/^\d+$/.test(tokenId)) return new Response("bad id", { status: 400 });
  try {
    const card = (await getPublicClient().readContract({
      address: CONTRACT_ADDRESSES.gafferNFT,
      abi: GAFFER_NFT_ABI,
      functionName: "getCard",
      args: [BigInt(tokenId)],
    })) as unknown as {
      playerId: string; position: number; rarity: number; tournamentPts: number;
      goals: number; assists: number; cleanSheets: number;
    };
    const p = getPlayer(card.playerId);
    const rarity = Number(card.rarity);
    const svg = renderCardSVG({
      name: p?.shortName ?? card.playerId,
      position: POSITION_NAME[Number(card.position)] ?? "FLEX",
      rating: p?.rating ?? 0,
      accent: RARITY_COLOR[rarity] ?? RARITY_COLOR[0],
      badge: RARITY_NAME[rarity] ?? "Bronze",
      nation: p?.nation,
      stats: [
        { label: "Tournament Pts", value: Number(card.tournamentPts) },
        { label: "Goals", value: Number(card.goals) },
        { label: "Assists", value: Number(card.assists) },
        { label: "Clean Sheets", value: Number(card.cleanSheets) },
      ],
    });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return new Response("token does not exist", { status: 404 });
  }
}
