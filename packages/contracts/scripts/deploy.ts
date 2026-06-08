import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. Oracle
  const Oracle = await ethers.getContractFactory("Oracle");
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();
  console.log("Oracle deployed:", await oracle.getAddress());

  // 2. GafferNFT
  const baseURI = process.env.BASE_URI || "https://api.gaffer.gg/metadata/";
  const GafferNFT = await ethers.getContractFactory("GafferNFT");
  const nft = await GafferNFT.deploy(baseURI);
  await nft.waitForDeployment();
  console.log("GafferNFT deployed:", await nft.getAddress());

  // 3. SquadWars
  const SquadWars = await ethers.getContractFactory("SquadWars");
  const squadWars = await SquadWars.deploy(await oracle.getAddress(), await nft.getAddress());
  await squadWars.waitForDeployment();
  console.log("SquadWars deployed:", await squadWars.getAddress());

  // 4. Wire up
  await nft.setSquadWarsContract(await squadWars.getAddress());
  console.log("GafferNFT wired to SquadWars");

  console.log("\n--- Deployment Complete ---");
  console.log("NEXT_PUBLIC_ORACLE_ADDRESS=" + await oracle.getAddress());
  console.log("NEXT_PUBLIC_NFT_ADDRESS=" + await nft.getAddress());
  console.log("NEXT_PUBLIC_SQUAD_WARS_ADDRESS=" + await squadWars.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
