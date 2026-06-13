#!/usr/bin/env node
// Initialize the gaffer-nft program: create the NftConfig PDA (owner = deployer,
// next_token_id = 1). No-ops if already initialized.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("Fhk54QhcVjY7phpxzF7HCPa6STsYD1FN8Jfwk2irdkGf");

const wallet = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(join(ROOT, ".solana", "devnet-keypair.json"), "utf8")))
);
const disc = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);

const conn = new Connection(RPC, "confirmed");
console.log("Program:", PROGRAM_ID.toBase58());
console.log("Config: ", config.toBase58());
console.log("Owner:  ", wallet.publicKey.toBase58());

if (await conn.getAccountInfo(config)) {
  console.log("\nNftConfig already exists — already initialized. Nothing to do.");
  process.exit(0);
}

const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: config, isSigner: false, isWritable: true },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: disc("initialize"),
});
const sig = await conn.sendTransaction(new Transaction().add(ix), [wallet]);
await conn.confirmTransaction(sig, "confirmed");
console.log("\n✓ Initialized. Signature:", sig);
