/**
 * Shared-secret guard for the /api/bot/* routes. These sign on-chain
 * transactions with the treasury wallet, so they MUST NOT be world-callable.
 *
 * Caller must send:  Authorization: Bearer <BOT_TRIGGER_SECRET>
 *                    (or  x-bot-secret: <BOT_TRIGGER_SECRET>)
 *
 * Fails closed: if BOT_TRIGGER_SECRET is unset the route is disabled (503),
 * so a misconfigured prod deploy can never expose an open treasury endpoint.
 */
import { NextResponse } from "next/server";

/** Returns a NextResponse to short-circuit with, or null if the request is authorized. */
export function checkBotAuth(req: Request): NextResponse | null {
  const secret = process.env.BOT_TRIGGER_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Bot endpoints disabled: BOT_TRIGGER_SECRET is not configured." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const provided = bearer || req.headers.get("x-bot-secret") || "";

  // length-aware constant-ish comparison
  if (provided.length !== secret.length || provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
