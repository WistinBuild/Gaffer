import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getServerConnection } from "@/lib/solanaServerRead";
import { getBotKeypair, sendBotIxs } from "@/lib/solanaServer";
import {
  getWar,
  getSquadCards,
  getOracleState,
  isMatchdayFinalized,
  scorePoints,
  ixPostPlayerResult,
  ixFinalizeMatchday,
  ixResolveWar,
  type ChainCard,
} from "@/lib/gafferPrograms";
import { checkBotAuth } from "@/lib/botAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EngStat {
  goals: number;
  assists: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  played: boolean;
}

/**
 * POST /api/bot/finalize
 * Body: { warId: number|string }
 *
 * Bot (oracle owner + wars resolver) engineers matchday stats so the user's
 * captain outscores the bot's, posts them to the Oracle, finalizes the matchday,
 * then resolves the war with the computed scores so the user wins the pot.
 *
 * Unlike the EVM contract (which scored on-chain), the Solana SquadWars program
 * takes resolver-submitted scores — so we replicate Oracle.calculate_points here.
 */
export async function POST(req: NextRequest) {
  const denied = checkBotAuth(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const warId = BigInt(body.warId);

    const conn = getServerConnection();
    const botPk = getBotKeypair().publicKey;

    const war = await getWar(conn, warId);
    if (!war) return NextResponse.json({ ok: false, error: `War ${warId} not found` }, { status: 404 });
    if (war.status !== 1) {
      return NextResponse.json(
        { ok: false, error: `War ${warId} is not active (status=${war.status})` },
        { status: 400 },
      );
    }

    const matchday = war.matchday;
    const challenger = new PublicKey(war.challenger);
    const opponent = new PublicKey(war.opponent);
    const challengerCards = (await getSquadCards(conn, challenger)) ?? [];
    const opponentCards = (await getSquadCards(conn, opponent)) ?? [];

    const result: Record<string, string> = {
      matchday: matchday.toString(),
      challengerCaptainSlot: String(war.captainSlot),
      opponentCaptainSlot: String(war.opponentCaptainSlot),
    };

    // ─── Engineer stats: user captain dominates, bot captain blanks ──────
    const userCaptainId = challengerCards[war.captainSlot]?.playerId;
    const botCaptainId = opponentCards[war.opponentCaptainSlot]?.playerId;
    const userIds = new Set(challengerCards.map((c) => c.playerId));

    const stats = new Map<string, EngStat>();
    const allIds = new Set<string>([
      ...challengerCards.map((c) => c.playerId),
      ...opponentCards.map((c) => c.playerId),
    ]);
    for (const pid of allIds) {
      let s: EngStat;
      if (pid === userCaptainId) s = mk(2, 1, 1);
      else if (pid === botCaptainId) s = mk(0, 0, 0);
      else if (userIds.has(pid)) s = mk(0, 1, 1);
      else s = mk(0, 0, 0);
      stats.set(pid, s);
    }

    // ─── Post results + finalize the matchday (once) ─────────────────────
    const finalState = await isMatchdayFinalized(conn, matchday);
    if (!finalState.finalized) {
      for (const [pid, s] of stats) {
        await sendBotIxs([ixPostPlayerResult(botPk, matchday, pid, s)], `post:${pid}`);
      }
      result.finalizeTxHash = await sendBotIxs(
        [ixFinalizeMatchday(botPk, matchday)],
        "finalizeMatchday",
      );
    }

    // ─── Compute scores using the snapshotted stage multiplier ───────────
    const oracle = await getOracleState(conn);
    const snap = await isMatchdayFinalized(conn, matchday);
    const mult = oracle?.stageMultiplier[snap.stage] ?? 100;

    const score = (cards: ChainCard[], captainSlot: number, benchedSlot: number) => {
      let total = 0;
      cards.forEach((c, i) => {
        if (i === benchedSlot) return;
        const s = stats.get(c.playerId);
        if (!s) return;
        let pts = scorePoints(s, c.position, mult);
        if (i === captainSlot) pts *= 2;
        total += pts;
      });
      return total;
    };
    const challengerScore = score(challengerCards, war.captainSlot, war.benchedSlot);
    const opponentScore = score(opponentCards, war.opponentCaptainSlot, war.opponentBenchedSlot);

    // ─── Resolve → winner gets the pot ───────────────────────────────────
    result.resolveTxHash = await sendBotIxs(
      [ixResolveWar(botPk, warId, challenger, opponent, botPk, challengerScore, opponentScore)],
      "resolveWar",
    );

    const finalWar = await getWar(conn, warId);
    return NextResponse.json({
      ok: true,
      ...result,
      winner: finalWar?.winner,
      challengerScore: String(challengerScore),
      opponentScore: String(opponentScore),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bot/finalize] failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function mk(goals: number, assists: number, cleanSheets: number): EngStat {
  return { goals, assists, cleanSheets, yellowCards: 0, redCards: 0, played: true };
}
