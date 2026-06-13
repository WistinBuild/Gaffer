/**
 * Server-only Solana signer for the /api/bot/* routes. Loads a bot/treasury
 * keypair from env and sends instructions. This wallet must also be the
 * Oracle owner + SquadWars resolver (the deploy uses one key for all three).
 *
 * NEVER import this from a client component.
 */
import {
  Connection,
  Keypair,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { getServerConnection } from "@/lib/solanaServerRead";

/** Default bot squad (used if the bot hasn't minted yet): 1 GK, 2 DEF, 1 MID, 1 FWD. */
export const BOT_SQUAD_PLAYER_IDS: [string, string, string, string, string] = [
  "courtois",
  "ruben_dias",
  "marquinhos",
  "casemiro",
  "kane",
];
export const BOT_SQUAD_POSITIONS: [number, number, number, number, number] = [0, 1, 1, 2, 3];

let _bot: Keypair | null = null;

/** Bot/treasury keypair from SOLANA_TREASURY_SECRET (JSON byte array or base58). */
export function getBotKeypair(): Keypair {
  if (_bot) return _bot;
  const raw = process.env.SOLANA_TREASURY_SECRET;
  if (!raw) {
    throw new Error(
      "SOLANA_TREASURY_SECRET env var is missing. Set it to the bot/treasury keypair " +
        "(JSON byte array from a Solana CLI keypair file, or a base58 secret key).",
    );
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    _bot = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)));
  } else {
    // base58 secret key — decode via web3's bs58 dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bs58 = require("bs58");
    _bot = Keypair.fromSecretKey(bs58.decode(trimmed));
  }
  return _bot;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send instruction(s) as one transaction signed by the bot, retrying on
 * transient errors. Like the EVM writeWithRetry: the bot fires dependent txs
 * back-to-back and an RPC node can simulate against stale state.
 */
export async function sendBotIxs(
  ixs: TransactionInstruction[],
  label: string,
  tries = 6,
): Promise<string> {
  const conn: Connection = getServerConnection();
  const bot = getBotKeypair();
  let lastErr: unknown;
  for (let i = 1; i <= tries; i++) {
    try {
      const tx = new Transaction().add(...ixs);
      tx.feePayer = bot.publicKey;
      tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
      const sig = await conn.sendTransaction(tx, [bot]);
      await conn.confirmTransaction(sig, "confirmed");
      return sig;
    } catch (err) {
      lastErr = err;
      await sleep(1500 * i);
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`${label} failed after ${tries} attempts: ${msg}`);
}
