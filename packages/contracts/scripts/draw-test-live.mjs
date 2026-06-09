/**
 * Live DRAW-path test against Base Sepolia.
 *
 * Reuses two funded wallets from .env.smoke10 (W0 + W2 — both already have a
 * squad). Runs one war on a fresh matchday where both sides lock IDENTICAL
 * captain/bench slots -> equal scores -> draw. Verifies the contract refunds
 * each side (pot - fee)/2 and sweeps the fee to the owner (no stuck funds).
 *
 * Run:  node scripts/draw-test-live.mjs
 */
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const RPC = "https://sepolia.base.org";
const CHAIN = 84532;
const MATCHDAY = 2;                          // matchday 1 is already finalized
const STAKE = ethers.parseUnits("1", 6);     // 1 USDC per side

const A = {
  oracle:    "0xA71AA07916FB97dE88207F22A7DCFfa758889684",
  squadWars: "0xC4fff945887425b293747e114AeC75d8887DFaC9",
  usdc:      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};
const SQUAD_IDS = ["alisson", "van_dijk", "rodri", "bellingham", "mbappe"];
const CAPTAIN = 4, BENCH = 0;                // SAME for both sides -> draw

const u6 = (v) => ethers.formatUnits(v, 6);
const ERC20 = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];
const WARS = [
  "function createWar(uint256,uint256)",
  "function acceptWar(uint256)",
  "function lockDecision(uint256,uint8,uint8)",
  "function resolveWar(uint256)",
  "function getWar(uint256) view returns (tuple(uint256 id,address challenger,address opponent,uint256 stake,uint256 matchday,uint8 captainSlot,uint8 benchedSlot,uint8 opponentCaptainSlot,uint8 opponentBenchedSlot,uint256 challengerScore,uint256 opponentScore,uint8 status,address winner,bool decisionLocked))",
  "event WarCreated(uint256 indexed warId,address indexed challenger,uint256 stake,uint256 matchday)",
];
const ORACLE = [
  "function postMatchdayResults(uint256,string[],uint8[],uint8[],uint8[],uint8[],uint8[],bool[])",
  "function matchdayFinalized(uint256) view returns (bool)",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, label, tries = 5) {
  let last;
  for (let t = 1; t <= tries; t++) {
    try { return await fn(); }
    catch (e) { last = e; if (/already known|nonce|replacement/.test(e.message || "")) throw e; await sleep(800 * t); }
  }
  throw new Error(`${label} failed: ${last?.shortMessage || last?.message}`);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN);
  const env = fs.readFileSync(path.join(root, ".env"), "utf8");
  const pk = (env.match(/PRIVATE_KEY=(.+)/) || [])[1].trim();
  const deployer = new ethers.Wallet(pk.startsWith("0x") ? pk : "0x" + pk, provider);

  const smoke = fs.readFileSync(path.join(root, ".env.smoke10"), "utf8").trim().split("\n").map((l) => l.split("=")[1]);
  const challenger = new ethers.Wallet(smoke[0], provider); // W0
  const opponent   = new ethers.Wallet(smoke[2], provider); // W2
  const owner = deployer.address;

  const usdc = new ethers.Contract(A.usdc, ERC20, provider);
  console.log(`Challenger (W0): ${challenger.address}  USDC ${u6(await usdc.balanceOf(challenger.address))}`);
  console.log(`Opponent   (W2): ${opponent.address}  USDC ${u6(await usdc.balanceOf(opponent.address))}`);
  console.log(`Owner          : ${owner}  USDC ${u6(await usdc.balanceOf(owner))}`);
  console.log(`Matchday ${MATCHDAY} finalized? ${await new ethers.Contract(A.oracle, ORACLE, provider).matchdayFinalized(MATCHDAY)}\n`);

  const cBal0 = await usdc.balanceOf(challenger.address);
  const oBal0 = await usdc.balanceOf(opponent.address);
  const ownerBal0 = await usdc.balanceOf(owner);

  // ── Approve (allowance was consumed by the earlier wars) ──────────────────
  for (const [w, tag] of [[challenger, "W0"], [opponent, "W2"]]) {
    const u = new ethers.Contract(A.usdc, ERC20, w);
    if ((await u.allowance(w.address, A.squadWars)) < STAKE) {
      await withRetry(async () => (await u.approve(A.squadWars, STAKE)).wait(), `${tag} approve`);
      console.log(`  ✓ ${tag} approved ${u6(STAKE)} USDC`);
    }
  }

  // ── Create -> accept -> both lock IDENTICAL decisions ─────────────────────
  const warsC = new ethers.Contract(A.squadWars, WARS, challenger);
  const warsO = new ethers.Contract(A.squadWars, WARS, opponent);
  const rc = await withRetry(async () => (await warsC.createWar(MATCHDAY, STAKE)).wait(), "createWar");
  let warId = 0n;
  for (const lg of rc.logs) { try { const p = warsC.interface.parseLog(lg); if (p?.name === "WarCreated") warId = p.args.warId; } catch {} }
  console.log(`  ✓ War #${warId} created (matchday ${MATCHDAY})`);
  await withRetry(async () => (await warsO.acceptWar(warId)).wait(), "acceptWar");
  console.log(`  ✓ W2 accepted`);
  await withRetry(async () => (await warsC.lockDecision(warId, CAPTAIN, BENCH)).wait(), "W0 lock");
  await withRetry(async () => (await warsO.lockDecision(warId, CAPTAIN, BENCH)).wait(), "W2 lock");
  console.log(`  ✓ both locked captain=${CAPTAIN} bench=${BENCH} (identical → expect draw)`);

  // ── Oracle posts matchday 2 (finalizes) ───────────────────────────────────
  const oracle = new ethers.Contract(A.oracle, ORACLE, deployer);
  if (!(await oracle.matchdayFinalized(MATCHDAY))) {
    await withRetry(async () => (await oracle.postMatchdayResults(
      MATCHDAY, SQUAD_IDS, [0, 0, 0, 1, 2], [0, 0, 1, 0, 0], [1, 1, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [true, true, true, true, true]
    )).wait(), "postMatchday");
    console.log(`  ✓ matchday ${MATCHDAY} posted + finalized`);
  }

  // ── Resolve ───────────────────────────────────────────────────────────────
  const warsD = new ethers.Contract(A.squadWars, WARS, deployer);
  await withRetry(async () => (await warsD.resolveWar(warId)).wait(), "resolveWar");

  // ── Verify ────────────────────────────────────────────────────────────────
  const w = await warsD.getWar(warId);
  const cBal1 = await usdc.balanceOf(challenger.address);
  const oBal1 = await usdc.balanceOf(opponent.address);
  const ownerBal1 = await usdc.balanceOf(owner);
  const STATUS = ["Open", "Active", "Resolved", "Cancelled"];

  console.log(`\n━━━━━━━━ DRAW RESULT ━━━━━━━━`);
  console.log(`War #${warId}  status=${STATUS[Number(w.status)]}`);
  console.log(`scores: challenger ${w.challengerScore} — opponent ${w.opponentScore}`);
  console.log(`winner: ${w.winner === ethers.ZeroAddress ? "DRAW (0x0)" : w.winner}`);
  console.log(`\nUSDC deltas (staked 1.0 each):`);
  console.log(`  W0 (challenger): ${u6(cBal1 - cBal0)}   net incl. stake`);
  console.log(`  W2 (opponent)  : ${u6(oBal1 - oBal0)}   net incl. stake`);
  console.log(`  owner (fee)    : +${u6(ownerBal1 - ownerBal0)}`);

  // Invariants: draw → each refunded (pot-fee)/2 = 0.95 (net -0.05), owner +0.1, conserved.
  const isDraw = w.winner === ethers.ZeroAddress && Number(w.status) === 2;
  const cNet = cBal1 - cBal0, oNet = oBal1 - oBal0, ownerNet = ownerBal1 - ownerBal0;
  const expNet = -ethers.parseUnits("0.05", 6);   // staked 1.0, refunded 0.95
  const ok = isDraw
    && cNet === expNet && oNet === expNet
    && ownerNet === ethers.parseUnits("0.1", 6)
    && (cNet + oNet + ownerNet) === 0n;            // fully conserved, nothing stuck
  console.log(`\n${ok ? "✅ PASS — draw refunds + fee sweep correct, funds conserved" : "❌ FAIL — unexpected draw accounting"}`);
  if (!ok) process.exitCode = 1;
}

main().catch((e) => { console.error("\n❌", e.shortMessage || e.message || e); process.exitCode = 1; });
