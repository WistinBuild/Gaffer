import { NextRequest, NextResponse } from "next/server";
import { type Address } from "viem";
import {
  getPublic,
  getBotWallet,
  getBotAccount,
  CONTRACT_ADDRESSES,
  SQUAD_WARS_ABI,
  GAFFER_NFT_ABI,
  USDC_ADDRESS,
  USDC_ABI,
  BOT_SQUAD_PLAYER_IDS,
  BOT_SQUAD_POSITIONS,
} from "@/lib/serverChain";
import { checkBotAuth } from "@/lib/botAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bot/challenge
 * Body: { warId: number, stake: string }  (stake in USDC base units, 6 decimals)
 *
 * The bot (treasury wallet):
 *   1. Mints a default squad if it hasn't yet
 *   2. Accepts the war (escrows matching stake)
 *   3. Locks its decision (captain slot 4, bench slot 3)
 */
export async function POST(req: NextRequest) {
  const denied = checkBotAuth(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const warId = BigInt(body.warId);
    const stake = BigInt(body.stake);

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

    // 2. Approve the protocol to pull the bot's USDC stake (if needed)
    const allowance = (await pub.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "allowance",
      args: [botAddr, CONTRACT_ADDRESSES.squadWars],
    })) as bigint;
    if (allowance < stake) {
      const approveHash = await wallet.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.squadWars, stake],
      });
      await pub.waitForTransactionReceipt({ hash: approveHash });
      result.approveTxHash = approveHash;
    }

    // 3. Accept war (escrows matching USDC stake)
    const acceptHash = await wallet.writeContract({
      address: CONTRACT_ADDRESSES.squadWars,
      abi: SQUAD_WARS_ABI,
      functionName: "acceptWar",
      args: [warId],
    });
    await pub.waitForTransactionReceipt({ hash: acceptHash });
    result.acceptTxHash = acceptHash;

    // 4. Lock bot decision — slot 4 captain, slot 3 bench
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
