/**
 * GET /api/card-image/player/:tokenId — SVG art for a marketplace player card.
 */
import { getPublicClient } from "@/lib/readChain";
import { CONTRACT_ADDRESSES, PLAYER_MINT_ABI } from "@/lib/contracts";
import { getPlayer, renderCardSVG, POSITION_NAME } from "@/lib/cardMetadata";

export const runtime = "nodejs";
export const revalidate = 300;

const LEGEND = "#8A5CF6";
const STANDARD = "#1FB6A6";

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  const { tokenId } = params;
  if (!/^\d+$/.test(tokenId)) return new Response("bad id", { status: 400 });
  try {
    const info = (await getPublicClient().readContract({
      address: CONTRACT_ADDRESSES.playerMint,
      abi: PLAYER_MINT_ABI,
      functionName: "tokenInfo",
      args: [BigInt(tokenId)],
    })) as unknown as {
      playerId: string; position: number; rating: number; isLegend: boolean; mintedAt: number;
    };
    const p = getPlayer(info.playerId);
    const legend = Boolean(info.isLegend);
    const svg = renderCardSVG({
      name: p?.shortName ?? info.playerId,
      position: POSITION_NAME[Number(info.position)] ?? "FLEX",
      rating: Number(info.rating),
      accent: legend ? LEGEND : STANDARD,
      badge: legend ? "Legend" : "Player",
      nation: p?.nation,
      stats: p
        ? [
            { label: "Pace", value: p.pace },
            { label: "Shooting", value: p.shooting },
            { label: "Passing", value: p.passing },
            { label: "Defending", value: p.defending },
            { label: "Physical", value: p.physical },
          ]
        : [{ label: "Overall", value: Number(info.rating) }],
    });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return new Response("token does not exist", { status: 404 });
  }
}
