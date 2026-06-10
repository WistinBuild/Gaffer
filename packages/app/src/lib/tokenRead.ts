/**
 * Resilient on-chain reads for the NFT metadata routes.
 *
 * The metadata endpoints are hit by marketplaces (OpenSea, wallets) that CACHE
 * responses — including 404s — aggressively. The app uses the public Base RPC,
 * which rate-limits under load. Without care, a transient RPC blip would surface
 * as a 404 and could permanently break an NFT's image in a marketplace cache.
 *
 * So: retry transient (network / rate-limit / timeout) errors a few times, and
 * only treat a genuine contract revert as "token does not exist" (404). Any
 * still-failing transient error returns 503 with no-store, so nothing caches it.
 */
import { NextResponse } from "next/server";
import { getPublicClient } from "@/lib/readChain";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A network/RPC hiccup (retryable) vs a real on-chain revert (token absent). */
export function isTransientRpcError(e: unknown): boolean {
  const err = e as { name?: string; details?: string; shortMessage?: string; message?: string };
  const s = `${err?.name ?? ""} ${err?.details ?? ""} ${err?.shortMessage ?? ""} ${err?.message ?? ""}`;
  // A genuine revert (nonexistent token) — NOT transient.
  if (/revert|ContractFunctionReverted|returned no data|ContractFunctionZeroData/i.test(s)) return false;
  // Network / provider rate-limit / timeout signatures — transient.
  return /HttpRequestError|TimeoutError|RpcRequestError|rate.?limit|over rate|429|408|500|502|503|504|fetch failed|network|ECONN|ETIMEDOUT|socket|missing revert data/i.test(s);
}

/**
 * readContract with bounded retries on transient errors. Genuine reverts throw
 * immediately (no wasted retries).
 */
export async function readTokenContract<T>(
  params: Parameters<ReturnType<typeof getPublicClient>["readContract"]>[0],
  tries = 4,
): Promise<T> {
  let last: unknown;
  for (let t = 1; t <= tries; t++) {
    try {
      return (await getPublicClient().readContract(params)) as T;
    } catch (e) {
      last = e;
      if (!isTransientRpcError(e)) throw e;
      await sleep(200 * t);
    }
  }
  throw last;
}

/** Map a failed read to the right response: 503 (uncached) for transient, 404 for a real miss. */
export function metadataErrorResponse(e: unknown): NextResponse {
  if (isTransientRpcError(e)) {
    return NextResponse.json(
      { error: "Upstream RPC unavailable, retry shortly" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json({ error: "Token does not exist" }, { status: 404 });
}
