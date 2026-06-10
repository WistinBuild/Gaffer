/**
 * Repoint the on-chain tokenURI base of both NFT contracts to your live domain,
 * replacing the placeholder api.gaffer.gg URLs. Owner-only (uses .env PRIVATE_KEY).
 *
 *   SITE_URL=https://gaffer.gg node scripts/set-base-uri.mjs
 *   node scripts/set-base-uri.mjs https://gaffer.gg
 *
 * After this, GafferNFT.tokenURI(id) -> <SITE_URL>/metadata/<id>
 *            PlayerMint.tokenURI(id) -> <SITE_URL>/players/<id>
 */
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const RPC = process.env.RPC_URL || "https://mainnet.base.org";
const CHAIN = Number(process.env.CHAIN_ID || "8453");
const A = {
  // Base mainnet contracts (migrated 2026-06-10). Override via NFT_ADDRESS / PLAYER_MINT_ADDRESS.
  nft:        process.env.NFT_ADDRESS        || "0x3d8c115be697ad89f5A177690C5e47b5E50eAEE2",
  playerMint: process.env.PLAYER_MINT_ADDRESS || "0x20b53C016Eca430fc38Cae42904f85c4aDAA880A",
};

async function main() {
  const site = (process.argv[2] || process.env.SITE_URL || "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(site)) {
    throw new Error("Pass your domain: SITE_URL=https://gaffer.gg node scripts/set-base-uri.mjs");
  }
  const metadataBase = `${site}/metadata/`;
  const playersBase  = `${site}/players/`;

  const env = fs.readFileSync(path.join(root, ".env"), "utf8");
  const pk = (env.match(/PRIVATE_KEY=(.+)/) || [])[1].trim();
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN);
  const owner = new ethers.Wallet(pk.startsWith("0x") ? pk : "0x" + pk, provider);

  const ABI = ["function setBaseURI(string)", "function tokenURI(uint256) view returns (string)"];
  const nft = new ethers.Contract(A.nft, ABI, owner);
  const pm  = new ethers.Contract(A.playerMint, ABI, owner);

  console.log(`Owner: ${owner.address}`);
  console.log(`GafferNFT  baseURI -> ${metadataBase}`);
  await (await nft.setBaseURI(metadataBase)).wait();
  console.log(`PlayerMint baseURI -> ${playersBase}`);
  await (await pm.setBaseURI(playersBase)).wait();

  // Verify against an existing token if present
  try { console.log(`\nGafferNFT.tokenURI(1)  = ${await nft.tokenURI(1)}`); } catch {}
  try { console.log(`PlayerMint.tokenURI(1) = ${await pm.tokenURI(1)}`); } catch {}
  console.log("\n✅ baseURI updated on both contracts.");
}

main().catch((e) => { console.error("❌", e.shortMessage || e.message || e); process.exitCode = 1; });
