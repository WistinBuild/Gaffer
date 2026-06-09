import { ethers } from "hardhat";

/**
 * Redeploy Oracle (stage-snapshot bugfix) + SquadWars (now has setOracle), wired
 * to the EXISTING GafferNFT + USDC. NFT and PlayerMint are NOT touched.
 *
 * This is non-breaking on its own: the old contracts keep serving the live site
 * until you (a) update the Railway env addresses and (b) re-wire the NFT.
 *
 * Cutover order (do NOT re-wire the NFT before Railway points at the new SquadWars,
 * or the OLD SquadWars can no longer forge NFT stats on resolve):
 *   1. Run this script (deploys + transfers ownership to the treasury).
 *   2. Update Railway env: NEXT_PUBLIC_ORACLE_ADDRESS + NEXT_PUBLIC_SQUAD_WARS_ADDRESS,
 *      redeploy the service.
 *   3. Re-run with REWIRE_NFT=1 to point GafferNFT at the new SquadWars.
 *
 * Env:
 *   NFT_ADDRESS         (default = live)
 *   USDC_ADDRESS        (required; from .env)
 *   TREASURY_ADDRESS    (default = current Oracle owner / bot key)
 *   REWIRE_NFT=1        (step 3 only — requires signer == NFT owner)
 *   NEW_SQUAD_WARS=0x.. (step 3 only — the SquadWars deployed in step 1)
 */

const NFT_ADDRESS = process.env.NFT_ADDRESS || "0x7c4Ca3602A251D7164F13CF7ae31465909E842DA";
const DEFAULT_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const TREASURY = process.env.TREASURY_ADDRESS || "0xfE7D82Ec80475beb91D041e56cdb0382657F8C54";

async function rewireOnly() {
  const [signer] = await ethers.getSigners();
  const nft = await ethers.getContractAt("GafferNFT", NFT_ADDRESS);
  const owner = await nft.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer ${signer.address} is not the GafferNFT owner (${owner}).`);
  }
  const newWars = process.env.NEW_SQUAD_WARS;
  if (!newWars) throw new Error("Set NEW_SQUAD_WARS=0x... to re-wire.");
  const tx = await nft.setSquadWarsContract(newWars);
  await tx.wait();
  console.log(`✓ GafferNFT now wired to SquadWars ${newWars}`);
}

async function main() {
  if (process.env.REWIRE_NFT === "1") return rewireOnly();

  const [signer] = await ethers.getSigners();
  const usdc = process.env.USDC_ADDRESS || DEFAULT_USDC;
  const bal = await ethers.provider.getBalance(signer.address);
  console.log("Deployer:", signer.address, "  Gas ETH:", ethers.formatEther(bal));
  console.log("Treasury (new owner):", TREASURY);
  console.log("NFT:", NFT_ADDRESS, "  USDC:", usdc);

  const Oracle = await ethers.getContractFactory("Oracle");
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("\nNew Oracle:", oracleAddr);

  const SquadWars = await ethers.getContractFactory("SquadWars");
  const wars = await SquadWars.deploy(oracleAddr, NFT_ADDRESS, usdc);
  await wars.waitForDeployment();
  const warsAddr = await wars.getAddress();
  console.log("New SquadWars:", warsAddr);

  // Hand the operational keys to the treasury (the bot posts Oracle results
  // and advances stages with the treasury key).
  await (await oracle.transferOwnership(TREASURY)).wait();
  await (await wars.transferOwnership(TREASURY)).wait();
  console.log("✓ Ownership of Oracle + SquadWars transferred to treasury");

  console.log("\n──────── NEXT STEPS (cutover) ────────");
  console.log("1. Update Railway env, then redeploy the service:");
  console.log("   NEXT_PUBLIC_ORACLE_ADDRESS=" + oracleAddr);
  console.log("   NEXT_PUBLIC_SQUAD_WARS_ADDRESS=" + warsAddr);
  console.log("2. After Railway is live on the new addresses, re-wire the NFT:");
  console.log(`   REWIRE_NFT=1 NEW_SQUAD_WARS=${warsAddr} npx hardhat run --network baseSepolia scripts/redeploy-oracle.ts`);
  console.log("\n(Old contracts keep working until step 1. Existing war history / W-L on the old SquadWars do not carry over.)");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
