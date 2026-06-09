/**
 * End-to-end smoke test against deployed Base Sepolia contracts.
 *
 * Steps:
 *  1. Generate / load wallet B, fund from deployer if needed
 *  2. Both wallets mint a 5-player squad
 *  3. Wallet A approves + creates a war (1 USDC stake)
 *  4. Wallet B approves + accepts the war
 *  5. Oracle (deployer) posts matchday results
 *  6. Anyone resolves the war
 *  7. Read final state — verify winner, scores, payout
 */
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// Filled from the deploy output — set these as env vars before running on Base Sepolia.
const ADDRS = {
  oracle:    process.env.NEXT_PUBLIC_ORACLE_ADDRESS    || "",
  nft:       process.env.NEXT_PUBLIC_NFT_ADDRESS       || "",
  squadWars: process.env.NEXT_PUBLIC_SQUAD_WARS_ADDRESS || "",
  usdc:      process.env.NEXT_PUBLIC_USDC_ADDRESS      || "",
};
if (!ADDRS.oracle || !ADDRS.nft || !ADDRS.squadWars || !ADDRS.usdc) {
  throw new Error(
    "Set NEXT_PUBLIC_ORACLE_ADDRESS, NEXT_PUBLIC_NFT_ADDRESS, NEXT_PUBLIC_SQUAD_WARS_ADDRESS " +
    "and NEXT_PUBLIC_USDC_ADDRESS to the deployed Base Sepolia addresses before running the smoke test.",
  );
}

const STAKE = ethers.parseUnits("1", 6); // 1 USDC (6 decimals)
const usdc6 = (v: bigint | number | string) => ethers.formatUnits(v, 6);
const MATCHDAY = 1;

// Two distinct squads (challenger + opponent)
const SQUAD_A = {
  ids: ["alisson", "van_dijk", "rodri", "bellingham", "mbappe"],
  positions: [0, 1, 2, 2, 3], // GK, DEF, MID, MID, FWD
};
const SQUAD_B = {
  ids: ["maignan", "kounde", "modric", "musiala", "vinicius"],
  positions: [0, 1, 2, 3, 3],
};

const log = (msg: string) => console.log(`  ${msg}`);
const step = (n: number, msg: string) => console.log(`\n━━ ${n}. ${msg} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

async function main() {
  const provider = ethers.provider;
  const [deployer] = await ethers.getSigners();
  log(`Deployer (wallet A · oracle owner): ${deployer.address}`);

  // ─── Wallet B — generate or load from .env.smoke ──────────────────────────
  const smokeEnvPath = path.resolve(__dirname, "../.env.smoke");
  let walletBPriv: string;
  if (fs.existsSync(smokeEnvPath)) {
    walletBPriv = fs.readFileSync(smokeEnvPath, "utf-8").trim().replace(/^PRIVATE_KEY_B=/, "");
    log(`Loaded wallet B from .env.smoke`);
  } else {
    const w = ethers.Wallet.createRandom();
    walletBPriv = w.privateKey;
    fs.writeFileSync(smokeEnvPath, `PRIVATE_KEY_B=${walletBPriv}\n`);
    log(`Generated fresh wallet B and saved to .env.smoke`);
  }
  const walletB = new ethers.Wallet(walletBPriv, provider);
  log(`Wallet B: ${walletB.address}`);

  // ─── Step 0 — fund wallet B if low ────────────────────────────────────────
  step(0, "Check balances + fund wallet B if needed");
  const balA0 = await provider.getBalance(deployer.address);
  const balB0 = await provider.getBalance(walletB.address);
  log(`Wallet A: ${ethers.formatEther(balA0)} ETH`);
  log(`Wallet B: ${ethers.formatEther(balB0)} ETH`);
  if (balB0 < ethers.parseEther("0.03")) {
    const need = ethers.parseEther("0.05");
    log(`Transferring 0.05 ETH from A → B…`);
    const tx = await deployer.sendTransaction({ to: walletB.address, value: need });
    await tx.wait();
    log(`✓ Funded. Wallet B now: ${ethers.formatEther(await provider.getBalance(walletB.address))} ETH`);
  }

  // ─── Contract handles ────────────────────────────────────────────────────
  const oracle    = await ethers.getContractAt("Oracle",    ADDRS.oracle,    deployer);
  const nftA      = await ethers.getContractAt("GafferNFT", ADDRS.nft,       deployer);
  const nftB      = await ethers.getContractAt("GafferNFT", ADDRS.nft,       walletB);
  const warsA     = await ethers.getContractAt("SquadWars", ADDRS.squadWars, deployer);
  const warsB     = await ethers.getContractAt("SquadWars", ADDRS.squadWars, walletB);

  const ERC20_ABI = [
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
  ];
  const usdcA = new ethers.Contract(ADDRS.usdc, ERC20_ABI, deployer);
  const usdcB = new ethers.Contract(ADDRS.usdc, ERC20_ABI, walletB);

  // Wallet B needs USDC to stake — top it up from the deployer if short.
  const usdcB0 = await usdcB.balanceOf(walletB.address);
  log(`Wallet B USDC: ${usdc6(usdcB0)}`);
  if (usdcB0 < STAKE) {
    log(`Transferring ${usdc6(STAKE)} USDC from A → B…`);
    const tx = await usdcA.transfer(walletB.address, STAKE);
    await tx.wait();
    log(`✓ Funded. Wallet B USDC now: ${usdc6(await usdcB.balanceOf(walletB.address))}`);
  }

  // ─── Step 1 — mint squad A ────────────────────────────────────────────────
  step(1, "Wallet A mints squad");
  const aMinted = await nftA.hasMinted(deployer.address);
  if (aMinted) {
    log(`Already minted — skipping`);
  } else {
    const tx = await nftA.mintSquad(SQUAD_A.ids, SQUAD_A.positions);
    const r = await tx.wait();
    log(`✓ mintSquad(A) ${r?.hash}  gas=${r?.gasUsed}`);
  }
  const squadA = await nftA.getSquad(deployer.address);
  log(`Squad A tokens: [${squadA.join(", ")}]`);

  // ─── Step 2 — mint squad B ────────────────────────────────────────────────
  step(2, "Wallet B mints squad");
  const bMinted = await nftB.hasMinted(walletB.address);
  if (bMinted) {
    log(`Already minted — skipping`);
  } else {
    const tx = await nftB.mintSquad(SQUAD_B.ids, SQUAD_B.positions);
    const r = await tx.wait();
    log(`✓ mintSquad(B) ${r?.hash}  gas=${r?.gasUsed}`);
  }
  const squadB = await nftB.getSquad(walletB.address);
  log(`Squad B tokens: [${squadB.join(", ")}]`);

  // ─── Step 3 — Wallet A creates war ────────────────────────────────────────
  step(3, "Wallet A approves + creates war");
  if ((await usdcA.allowance(deployer.address, ADDRS.squadWars)) < STAKE) {
    await (await usdcA.approve(ADDRS.squadWars, STAKE)).wait();
    log(`✓ approved ${usdc6(STAKE)} USDC`);
  }
  const txCreate = await warsA.createWar(MATCHDAY, STAKE);
  const rCreate = await txCreate.wait();
  // Parse WarCreated event for warId
  let warId: bigint = 0n;
  for (const log of rCreate?.logs ?? []) {
    try {
      const parsed = warsA.interface.parseLog(log);
      if (parsed?.name === "WarCreated") warId = parsed.args.warId;
    } catch {}
  }
  console.log(`  ✓ War #${warId} created  ${rCreate?.hash}  gas=${rCreate?.gasUsed}`);

  // ─── Step 4 — Wallet B accepts ────────────────────────────────────────────
  step(4, "Wallet B approves + accepts war");
  if ((await usdcB.allowance(walletB.address, ADDRS.squadWars)) < STAKE) {
    await (await usdcB.approve(ADDRS.squadWars, STAKE)).wait();
    log(`✓ approved ${usdc6(STAKE)} USDC`);
  }
  const txAccept = await warsB.acceptWar(warId);
  const rAccept = await txAccept.wait();
  log(`✓ acceptWar(${warId})  ${rAccept?.hash}  gas=${rAccept?.gasUsed}`);

  // ─── Step 5 — Oracle posts matchday results ───────────────────────────────
  step(5, "Oracle posts matchday results");
  const isFinalized = await oracle.matchdayFinalized(MATCHDAY);
  if (isFinalized) {
    log(`Matchday ${MATCHDAY} already finalized — skipping`);
  } else {
    // Combine both squads' players into one results post
    const allIds = [...new Set([...SQUAD_A.ids, ...SQUAD_B.ids])];
    const goals       = allIds.map(id => id === "mbappe" ? 2 : id === "vinicius" ? 1 : id === "bellingham" ? 1 : 0);
    const assists     = allIds.map(id => id === "rodri" ? 1 : id === "modric" ? 1 : 0);
    const cleanSheets = allIds.map(id => id === "alisson" || id === "van_dijk" || id === "kounde" ? 1 : 0);
    const yellowCards = allIds.map(() => 0);
    const redCards    = allIds.map(() => 0);
    const played      = allIds.map(() => true);

    const tx = await oracle.postMatchdayResults(
      MATCHDAY, allIds, goals, assists, cleanSheets, yellowCards, redCards, played
    );
    const r = await tx.wait();
    log(`✓ postMatchdayResults  ${r?.hash}  gas=${r?.gasUsed}`);
    log(`   Players posted: ${allIds.length}`);
  }

  // ─── Step 6 — Resolve war ─────────────────────────────────────────────────
  step(6, "Resolve war");
  const warBefore = await warsA.getWar(warId);
  if (Number(warBefore.status) === 2) {
    log(`War #${warId} already resolved (status=Resolved)`);
  } else {
    const balA_pre = await usdcA.balanceOf(deployer.address);
    const balB_pre = await usdcB.balanceOf(walletB.address);
    const tx = await warsA.resolveWar(warId);
    const r = await tx.wait();
    log(`✓ resolveWar(${warId})  ${r?.hash}  gas=${r?.gasUsed}`);

    // ─── Step 7 — Final state ────────────────────────────────────────────────
    step(7, "Final state");
    const war = await warsA.getWar(warId);
    const balA_post = await usdcA.balanceOf(deployer.address);
    const balB_post = await usdcB.balanceOf(walletB.address);

    log(`War status:       ${["Open","Active","Resolved","Cancelled"][Number(war.status)]}`);
    log(`Challenger:       ${war.challenger}  (score ${war.challengerScore})`);
    log(`Opponent:         ${war.opponent}    (score ${war.opponentScore})`);
    log(`Winner:           ${war.winner === ethers.ZeroAddress ? "DRAW" : war.winner}`);
    log(``);
    log(`Wallet A USDC net: ${usdc6(balA_post - balA_pre)} (after resolve)`);
    log(`Wallet B USDC net: ${usdc6(balB_post - balB_pre)} (after resolve)`);
  }

  // ─── Reputation reads ────────────────────────────────────────────────────
  step(8, "Reputation reads");
  const winsA = await warsA.wins(deployer.address);
  const lossesA = await warsA.losses(deployer.address);
  const winsB = await warsA.wins(walletB.address);
  const lossesB = await warsA.losses(walletB.address);
  log(`Wallet A: ${winsA}W / ${lossesA}L`);
  log(`Wallet B: ${winsB}W / ${lossesB}L`);

  console.log("\n✅ Smoke test complete.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
