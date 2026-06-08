import { NextRequest, NextResponse } from "next/server";
import { parseEther, type Address } from "viem";
import {
  getPublic,
  getBotWallet,
  getBotAccount,
  CONTRACT_ADDRESSES,
  SQUAD_WARS_ABI,
  GAFFER_NFT_ABI,
  BOT_SQUAD_PLAYER_IDS,
  BOT_SQUAD_POSITIONS,
} from "@/lib/serverChain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bot/challenge
 * Body: { warId: number, stakeWei: string }
 *
 * The bot (treasury wallet):
 *   1. Mints a default squad if it hasn't yet
 *   2. Accepts the war (escrows matching stake)
 *   3. Locks its decision (captain slot 4, bench slot 3)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const warId = BigInt(body.warId);
    const stake = BigInt(body.stakeWei);

    const pub = getPublic();
    const wallet = getBotWallet();
    const bot = getBotAccount();
    const botAddr = bot.address as Address;

    const result: Record<string, string> = { botAddress: botAddr };

    // 1. Ensure bot has minted a squad
    const hasMinted = (await pub.readContract({
      address: CONTRACT_ADDRESSES.gafferNFT,
      abi: GAFFER_NFT_ABI,
      functionName: "hasMinted",
      args: [botAddr],
    })) as boolean;

    if (!hasMinted) {
      const mintHash = await wallet.writeContract({
        address: CONTRACT_ADDRESSES.gafferNFT,
        abi: GAFFER_NFT_ABI,
        functionName: "mintSquad",
        args: [BOT_SQUAD_PLAYER_IDS, BOT_SQUAD_POSITIONS],
      });
      await pub.waitForTransactionReceipt({ hash: mintHash });
      result.mintTxHash = mintHash;
    }

    // 2. Accept war
    const acceptHash = await wallet.writeContract({
      address: CONTRACT_ADDRESSES.squadWars,
      abi: SQUAD_WARS_ABI,
      functionName: "acceptWar",
      args: [warId],
      value: stake,
    });
    await pub.waitForTransactionReceipt({ hash: acceptHash });
    result.acceptTxHash = acceptHash;

    // 3. Lock bot decision — slot 4 captain, slot 3 bench
    const lockHash = await wallet.writeContract({
      address: CONTRACT_ADDRESSES.squadWars,
      abi: SQUAD_WARS_ABI,
      functionName: "lockDecision",
      args: [warId, 4, 3],
    });
    await pub.waitForTransactionReceipt({ hash: lockHash });
    result.lockTxHash = lockHash;

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bot/challenge] failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
