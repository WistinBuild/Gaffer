import { NextRequest, NextResponse } from "next/server";
import { getServerConnection } from "@/lib/solanaServerRead";
import {
  getBotKeypair,
  sendBotIxs,
  BOT_SQUAD_PLAYER_IDS,
  BOT_SQUAD_POSITIONS,
} from "@/lib/solanaServer";
import { hasMintedSquad, ataPda, ixMintSquad, ixAcceptWar, ixLockDecision } from "@/lib/gafferPrograms";
import { checkBotAuth } from "@/lib/botAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bot/challenge
 * Body: { warId: number|string }
 *
 * The bot (treasury wallet):
 *   1. Mints a default squad if it hasn't yet
 *   2. Accepts the war (escrows matching USDC stake from its ATA — no approve
 *      step on Solana; the SPL transfer is authorized by the bot's signature)
 *   3. Locks its decision (captain slot 4, bench slot 3)
 */
export async function POST(req: NextRequest) {
  const denied = checkBotAuth(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const warId = BigInt(body.warId);

    const conn = getServerConnection();
    const botPk = getBotKeypair().publicKey;
    const result: Record<string, string> = { botAddress: botPk.toBase58() };

    // 1. Ensure the bot has a squad.
    if (!(await hasMintedSquad(conn, botPk))) {
      result.mintTxHash = await sendBotIxs(
        [ixMintSquad(botPk, BOT_SQUAD_PLAYER_IDS, BOT_SQUAD_POSITIONS)],
        "mintSquad",
      );
    }

    // 2. Accept the war (escrows matching USDC stake).
    result.acceptTxHash = await sendBotIxs(
      [ixAcceptWar(botPk, warId, ataPda(botPk))],
      "acceptWar",
    );

    // 3. Lock bot decision — captain slot 4, bench slot 3.
    result.lockTxHash = await sendBotIxs([ixLockDecision(botPk, warId, 4, 3)], "lockDecision");

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bot/challenge] failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
