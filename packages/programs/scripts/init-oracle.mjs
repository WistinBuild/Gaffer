#!/usr/bin/env node
// Initialize the deployed Oracle program: calls the `initialize` instruction to
// create the OracleState PDA (owner = deployer, stage = Group, matchday = 1,
// multipliers [100,120,150,200,300]). Idempotent-ish: re-running fails because
// the PDA already exists, which is the expected "already initialized" signal.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("3byJrFHoZ4v9tTo9XAKn1KrE82LZSAxwqMDijVXMf5Yb");

const wallet = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(join(ROOT, ".solana", "devnet-keypair.json"), "utf8")))
);

// Anchor instruction discriminator = sha256("global:<name>")[0..8]
const disc = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);

const [oracleState] = PublicKey.findProgramAddressSync([Buffer.from("oracle")], PROGRAM_ID);

const conn = new Connection(RPC, "confirmed");
console.log("Program:     ", PROGRAM_ID.toBase58());
console.log("Owner:       ", wallet.publicKey.toBase58());
console.log("OracleState: ", oracleState.toBase58());

const existing = await conn.getAccountInfo(oracleState);
if (existing) {
  console.log("\nOracleState already exists — program is already initialized. Nothing to do.");
  process.exit(0);
}

const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: oracleState, isSigner: false, isWritable: true },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: disc("initialize"),
});

console.log("\nSending initialize…");
const tx = new Transaction().add(ix);
const sig = await conn.sendTransaction(tx, [wallet]);
await conn.confirmTransaction(sig, "confirmed");
console.log("✓ Initialized. Signature:", sig);
console.log("  Explorer:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
