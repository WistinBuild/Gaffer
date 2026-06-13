#!/usr/bin/env node
// Initialize player-mint: create MintConfig + the USDC vault token account.
// USDC mint defaults to Circle's devnet USDC; override with USDC_MINT env.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY,
  Transaction, TransactionInstruction,
} from "@solana/web3.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("D9xiskVonYcZs3zMnjeKS9HY27s2fcBxTD3Jw5op2XoY");
const USDC_MINT = new PublicKey(process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const wallet = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(join(ROOT, ".solana", "devnet-keypair.json"), "utf8")))
);
const disc = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID);

const conn = new Connection(RPC, "confirmed");
console.log("Program:", PROGRAM_ID.toBase58());
console.log("Config: ", config.toBase58());
console.log("Vault:  ", vault.toBase58());
console.log("USDC:   ", USDC_MINT.toBase58());

if (await conn.getAccountInfo(config)) {
  console.log("\nMintConfig already exists — already initialized.");
  process.exit(0);
}

const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: config, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: USDC_MINT, isSigner: false, isWritable: false },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ],
  data: disc("initialize"),
});
const sig = await conn.sendTransaction(new Transaction().add(ix), [wallet]);
await conn.confirmTransaction(sig, "confirmed");
console.log("\n✓ Initialized. Signature:", sig);
