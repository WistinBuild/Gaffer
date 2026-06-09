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

const RPC = process.env.RPC_URL || "https://sepolia.base.org";
const CHAIN = Number(process.env.CHAIN_ID || "84532");
const A = {
  nft:        "0x7c4Ca3602A251D7164F13CF7ae31465909E842DA",
  playerMint: "0xa3f3bf7ea21BB098E19a1C9b1B5813d6404ee9eC",
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
