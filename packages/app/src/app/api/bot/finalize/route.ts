import { NextRequest, NextResponse } from "next/server";
import { type Address } from "viem";
import {
  getPublic,
  getBotWallet,
  CONTRACT_ADDRESSES,
  SQUAD_WARS_ABI,
  GAFFER_NFT_ABI,
  ORACLE_ABI,
} from "@/lib/serverChain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Card {
  playerId: string;
  position: number;
  rarity: number;
  tournamentPts: number;
  goals: number;
  assists: number;
  cleanSheets: number;
}

interface War {
  id: bigint;
  challenger: Address;
  opponent: Address;
  stake: bigint;
  matchday: bigint;
  captainSlot: number;
  benchedSlot: number;
  opponentCaptainSlot: number;
  opponentBenchedSlot: number;
  challengerScore: bigint;
  opponentScore: bigint;
  status: number;
  winner: Address;
  decisionLocked: boolean;
}

async function readSquadPlayerIds(
  pub: ReturnType<typeof getPublic>,
  owner: Address,
): Promise<string[]> {
  const tokenIds = (await pub.readContract({
    address: CONTRACT_ADDRESSES.gafferNFT,
    abi: GAFFER_NFT_ABI,
    functionName: "getSquad",
    args: [owner],
  })) as readonly bigint[];

  const cards = await Promise.all(
    tokenIds.map(async (tid) => {
      const c = (await pub.readContract({
        address: CONTRACT_ADDRESSES.gafferNFT,
        abi: GAFFER_NFT_ABI,
        functionName: "getCard",
        args: [tid],
      })) as unknown as Card;
      return c.playerId;
    }),
  );
  return cards;
}

/**
 * POST /api/bot/finalize
 * Body: { warId: number }
 *
 * Bot (oracle owner) engineers matchday stats so the user's captain outscores
 * the bot's captain (~10% margin), then resolves the war so the user wins
 * the pot on-chain. If matchday is already finalized, skips straight to
 * resolveWar.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const warId = BigInt(body.warId);

    const pub = getPublic();
    const wallet = getBotWallet();

    const war = (await pub.readContract({
      address: CONTRACT_ADDRESSES.squadWars,
      abi: SQUAD_WARS_ABI,
      functionName: "getWar",
      args: [warId],
    })) as unknown as War;

    if (war.status !== 1) {
      return NextResponse.json(
        { ok: false, error: `War ${warId} is not active (status=${war.status})` },
        { status: 400 },
      );
    }

    const matchday = war.matchday;
    const result: Record<string, string | bigint> = {
      matchday: matchday.toString(),
      challengerCaptainSlot: war.captainSlot.toString(),
      opponentCaptainSlot: war.opponentCaptainSlot.toString(),
    };

    // ─── Check if matchday already finalized ─────────────────────────────
    const alreadyFinal = (await pub.readContract({
      address: CONTRACT_ADDRESSES.oracle,
      abi: ORACLE_ABI,
      functionName: "matchdayFinalized",
      args: [matchday],
    })) as boolean;

    if (!alreadyFinal) {
      // Read both squads' player IDs
      const userPlayers = await readSquadPlayerIds(pub, war.challenger);
      const botPlayers  = await readSquadPlayerIds(pub, war.opponent);

      const userCaptainId = userPlayers[war.captainSlot];
      const botCaptainId  = botPlayers[war.opponentCaptainSlot];

      // Engineered stats: user captain dominates, bot captain underperforms,
      // others get baseline contributions. Score formula in Oracle.calculatePoints
      // is position-weighted; giving the user captain a goal+assist+cleanSheet
      // produces enough margin even after the bot's ~90% scoring.
      const ids = new Set<string>();
      [...userPlayers, ...botPlayers].forEach((p) => ids.add(p));
      const playerIds = Array.from(ids);

      const goals: number[]       = [];
      const assists: number[]     = [];
      const cleanSheets: number[] = [];
      const yellows: number[]     = [];
      const reds: number[]        = [];
      const played: boolean[]     = [];

      for (const pid of playerIds) {
        if (pid === userCaptainId) {
          goals.push(2); assists.push(1); cleanSheets.push(1);
        } else if (pid === botCaptainId) {
          goals.push(0); assists.push(0); cleanSheets.push(0);
        } else if (userPlayers.includes(pid)) {
          goals.push(0); assists.push(1); cleanSheets.push(1);
        } else {
          goals.push(0); assists.push(0); cleanSheets.push(0);
        }
        yellows.push(0); reds.push(0); played.push(true);
      }

      const postHash = await wallet.writeContract({
        address: CONTRACT_ADDRESSES.oracle,
        abi: ORACLE_ABI,
        functionName: "postMatchdayResults",
        args: [matchday, playerIds, goals, assists, cleanSheets, yellows, reds, played],
      });
      await pub.waitForTransactionReceipt({ hash: postHash });
      result.postTxHash = postHash;
    }

    // ─── Resolve war → winner gets pot ───────────────────────────────────
    const resolveHash = await wallet.writeContract({
      address: CONTRACT_ADDRESSES.squadWars,
      abi: SQUAD_WARS_ABI,
      functionName: "resolveWar",
      args: [warId],
    });
    const receipt = await pub.waitForTransactionReceipt({ hash: resolveHash });
    result.resolveTxHash = resolveHash;
    result.resolveBlockNumber = receipt.blockNumber.toString();

    // Re-read final state
    const finalWar = (await pub.readContract({
      address: CONTRACT_ADDRESSES.squadWars,
      abi: SQUAD_WARS_ABI,
      functionName: "getWar",
      args: [warId],
    })) as unknown as War;

    return NextResponse.json({
      ok: true,
      ...result,
      winner: finalWar.winner,
      challengerScore: finalWar.challengerScore.toString(),
      opponentScore:   finalWar.opponentScore.toString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bot/finalize] failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
