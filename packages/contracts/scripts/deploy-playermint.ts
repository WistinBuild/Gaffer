import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// ─── Price + supply formula — mirrors packages/app/src/lib/market.ts ──────────
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Circle USDC on Base Sepolia (override with USDC_ADDRESS).
const DEFAULT_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Mirrors packages/app/src/lib/market.ts — keep identical. Tuned so the most
// expensive card (Pelé) seeds at exactly 1.00 USDC; floor ~0.063 USDC.
const PRICE_SCALE = 2.440104;

function priceUSDC(p: any): number {
  const norm = Math.max(0, Math.min(1, (p.rating - 70) / 30));
  const ratingPremium = Math.pow(norm, 2.4) * 0.18;
  let price = 0.002 + ratingPremium;
  if (p.legend) price *= 2.6;
  const seed = hashSeed(p.id);
  const variance = (((seed * 7) % 37) - 18) / 100;
  price *= 1 + variance;
  price *= PRICE_SCALE;
  return Math.round(price * 1000) / 1000;
}

function maxSupply(p: any): number {
  if (p.legend) return 100;
  if (p.rating >= 92) return 500;
  if (p.rating >= 88) return 2000;
  if (p.rating >= 84) return 5000;
  return 10000;
}

const POSITION_MAP: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3, FLEX: 4 };

async function main() {
  const [signer] = await ethers.getSigners();
  const usdcAddress = process.env.USDC_ADDRESS || DEFAULT_USDC;
  const balBefore = await ethers.provider.getBalance(signer.address);
  console.log("Deployer:", signer.address);
  console.log("Balance: ", ethers.formatEther(balBefore), "ETH (gas)");
  console.log("USDC token:", usdcAddress);

  // ── Deploy PlayerMint
  const Factory = await ethers.getContractFactory("PlayerMint");
  const contract = await Factory.deploy("https://api.gaffer.gg/players/", usdcAddress);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("\nPlayerMint deployed at:", addr);

  // ── Load players.json
  const playersPath = path.resolve(__dirname, "../../app/src/data/players.json");
  const players = JSON.parse(fs.readFileSync(playersPath, "utf-8"));
  console.log(`\nSeeding catalog with ${players.length} players (batched)...`);

  // ── Batch in chunks of 25 to keep tx size reasonable
  const CHUNK = 25;
  for (let i = 0; i < players.length; i += CHUNK) {
    const slice = players.slice(i, i + CHUNK);
    const ids       = slice.map((p: any) => p.id);
    const positions = slice.map((p: any) => POSITION_MAP[p.position] ?? 4);
    const ratings   = slice.map((p: any) => p.rating);
    const legends   = slice.map((p: any) => Boolean(p.legend));
    const prices    = slice.map((p: any) => ethers.parseUnits(priceUSDC(p).toFixed(6), 6));
    const supplies  = slice.map((p: any) => maxSupply(p));

    const tx = await contract.setCatalogBatch(ids, positions, ratings, legends, prices, supplies);
    const r = await tx.wait();
    console.log(`  ✓ Batch ${Math.floor(i / CHUNK) + 1}: ${slice.length} players  (gas: ${r?.gasUsed?.toString()})`);
  }

  const balAfter = await ethers.provider.getBalance(signer.address);
  const cost = balBefore - balAfter;
  console.log("\n--- Done ---");
  console.log("Total deploy + seed cost:", ethers.formatEther(cost), "ETH (gas)");
  console.log("\nAdd this to packages/app/.env.local:");
  console.log("NEXT_PUBLIC_PLAYER_MINT_ADDRESS=" + addr);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
