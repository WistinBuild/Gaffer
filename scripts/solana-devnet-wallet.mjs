#!/usr/bin/env node
// Generate a Solana devnet wallet and request a faucet airdrop.
// Saves the keypair in Solana CLI format (64-byte JSON array) to .solana/devnet-keypair.json
import { webcrypto } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createSolanaRpc,
  getAddressFromPublicKey,
  lamports,
} from "@solana/kit";

const { subtle } = webcrypto;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY_DIR = join(ROOT, ".solana");
const KEY_PATH = join(KEY_DIR, "devnet-keypair.json");
const DEVNET_RPC = "https://api.devnet.solana.com";

async function loadOrCreateKeypair() {
  if (existsSync(KEY_PATH)) {
    const bytes = Uint8Array.from(JSON.parse(readFileSync(KEY_PATH, "utf8")));
    const seed = bytes.slice(0, 32);
    const pub = bytes.slice(32);
    const pubKey = await subtle.importKey("raw", pub, "Ed25519", true, ["verify"]);
    const addr = await getAddressFromPublicKey(pubKey);
    return { addr, created: false, seed, pub };
  }
  const kp = await subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  const pub = new Uint8Array(await subtle.exportKey("raw", kp.publicKey));
  const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", kp.privateKey));
  const seed = pkcs8.slice(pkcs8.length - 32); // ed25519 pkcs8 = 16-byte header + 32-byte seed
  const secret64 = new Uint8Array(64);
  secret64.set(seed, 0);
  secret64.set(pub, 32);
  mkdirSync(KEY_DIR, { recursive: true });
  writeFileSync(KEY_PATH, JSON.stringify(Array.from(secret64)));
  const addr = await getAddressFromPublicKey(kp.publicKey);
  return { addr, created: true, seed, pub };
}

const { addr, created } = await loadOrCreateKeypair();
console.log(created ? "Generated new devnet wallet:" : "Using existing devnet wallet:");
console.log("  Address:", addr);
console.log("  Keypair:", KEY_PATH);

const rpc = createSolanaRpc(DEVNET_RPC);

async function balanceSol() {
  const { value } = await rpc.getBalance(addr).send();
  return Number(value) / 1e9;
}

console.log("\nCurrent balance:", await balanceSol(), "SOL");
console.log("Requesting 1 SOL airdrop on devnet...");
try {
  const sig = await rpc.requestAirdrop(addr, lamports(1_000_000_000n)).send();
  console.log("  Airdrop signature:", sig);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const bal = await balanceSol();
    if (bal > 0) {
      console.log("  Confirmed. New balance:", bal, "SOL");
      break;
    }
    process.stdout.write(".");
  }
} catch (e) {
  console.error("  Airdrop failed (devnet faucet is rate-limited):", e?.message || e);
  console.error("  You can also fund manually at https://faucet.solana.com/ (address above).");
}
