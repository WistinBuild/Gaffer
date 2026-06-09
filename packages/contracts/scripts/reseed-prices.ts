import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Re-seed the EXISTING PlayerMint catalog with new prices (and supply caps),
 * without redeploying. Owner-only. Price formula is mirrored from
 * packages/app/src/lib/market.ts — keep the two in sync.
 *
 * Usage:
 *   PLAYER_MINT_ADDRESS=0x... npx hardhat run --network baseSepolia scripts/reseed-prices.ts
 */

const PLAYER_MINT =
  process.env.PLAYER_MINT_ADDRESS || "0xa3f3bf7ea21BB098E19a1C9b1B5813d6404ee9eC";

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PRICE_SCALE = 2.440104; // most expensive card -> 1.00 USDC

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
  const pm = await ethers.getContractAt("PlayerMint", PLAYER_MINT);

  const owner = await pm.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer ${signer.address} is not the PlayerMint owner (${owner}).`);
  }
  console.log("Re-seeding catalog on", PLAYER_MINT, "as owner", signer.address);

  const playersPath = path.resolve(__dirname, "../../app/src/data/players.json");
  const players = JSON.parse(fs.readFileSync(playersPath, "utf-8"));

  const prices = players.map((p: any) => priceUSDC(p));
  console.log(
    `Players: ${players.length}  max: ${Math.max(...prices)} USDC  min: ${Math.min(...prices)} USDC`,
  );

  const CHUNK = 25;
  for (let i = 0; i < players.length; i += CHUNK) {
    const slice = players.slice(i, i + CHUNK);
    const ids = slice.map((p: any) => p.id);
    const positions = slice.map((p: any) => POSITION_MAP[p.position] ?? 4);
    const ratings = slice.map((p: any) => p.rating);
    const legends = slice.map((p: any) => Boolean(p.legend));
    const priceUnits = slice.map((p: any) => ethers.parseUnits(priceUSDC(p).toFixed(6), 6));
    const supplies = slice.map((p: any) => maxSupply(p));

    const tx = await pm.setCatalogBatch(ids, positions, ratings, legends, priceUnits, supplies);
    const r = await tx.wait();
    console.log(`  ✓ Batch ${Math.floor(i / CHUNK) + 1}: ${slice.length} players (gas: ${r?.gasUsed?.toString()})`);
  }

  // Spot-check the top card on-chain
  const top = await pm.catalogOf("pele");
  console.log("\npele on-chain price:", ethers.formatUnits(top.price, 6), "USDC");
  console.log("Done. Note: setCatalogBatch preserves each player's existing `minted` count.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
