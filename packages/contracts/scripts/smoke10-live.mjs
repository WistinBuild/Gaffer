/**
 * 10-wallet end-to-end smoke test against the LIVE Base Sepolia deployment.
 *
 * Generates 10 fresh wallets (saved to .env.smoke10, gitignored), funds each
 * with a little ETH (gas) + 1 USDC (stake) from the .env deployer wallet, then:
 *   - all 10 mint a squad
 *   - pairs them into 5 wars on matchday 1: create -> accept -> lock decisions
 *   - deployer (oracle owner) posts matchday 1 results  (finalizes it)
 *   - resolves all 5 wars and reports winners / scores / payouts / reputation
 *
 * Run:  node scripts/smoke10-live.mjs
 */
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ─── Config ──────────────────────────────────────────────────────────────────
const RPC = "https://sepolia.base.org";
const CHAIN = 84532;
const N = 10;                                  // wallets
const MATCHDAY = 1;
const STAKE = ethers.parseUnits("1", 6);       // 1 USDC per side
const ETH_FUND = ethers.parseEther("0.0006");  // gas per wallet (huge buffer at ~0.01 gwei)

const A = {
  oracle:    "0xA71AA07916FB97dE88207F22A7DCFfa758889684",
  nft:       "0x7c4Ca3602A251D7164F13CF7ae31465909E842DA",
  squadWars: "0xC4fff945887425b293747e114AeC75d8887DFaC9",
  usdc:      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

// One shared valid formation (one GK) — identical squads are allowed across managers.
const SQUAD_IDS = ["alisson", "van_dijk", "rodri", "bellingham", "mbappe"];
const SQUAD_POS = [0, 1, 2, 2, 3];             // GK, DEF, MID, MID, FWD
// Slot map: 0 alisson(GK) 1 van_dijk 2 rodri 3 bellingham 4 mbappe(top scorer)
const CHALLENGER_CAPTAIN = 4, CHALLENGER_BENCH = 0;  // doubles mbappe, benches GK -> wins
const OPPONENT_CAPTAIN   = 0, OPPONENT_BENCH   = 4;  // doubles GK, benches mbappe -> loses

const u6 = (v) => ethers.formatUnits(v, 6);
const eth = (v) => ethers.formatEther(v);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Public Base Sepolia RPC is flaky under load — retry transient errors.
async function withRetry(fn, label, tries = 5) {
  let last;
  for (let t = 1; t <= tries; t++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      const msg = e.shortMessage || e.message || String(e);
      if (/already known|nonce|replacement/.test(msg)) throw e; // don't retry nonce issues blindly
      await sleep(800 * t);
    }
  }
  throw new Error(`${label} failed after ${tries} tries: ${last?.shortMessage || last?.message}`);
}

// Run async tasks with bounded concurrency to avoid hammering the public RPC.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const ERC20 = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
];
const NFT = [
  "function mintSquad(string[5],uint8[5])",
  "function hasMinted(address) view returns (bool)",
];
const WARS = [
  "function createWar(uint256,uint256)",
  "function acceptWar(uint256)",
  "function lockDecision(uint256,uint8,uint8)",
  "function resolveWar(uint256)",
  "function getWar(uint256) view returns (tuple(uint256 id,address challenger,address opponent,uint256 stake,uint256 matchday,uint8 captainSlot,uint8 benchedSlot,uint8 opponentCaptainSlot,uint8 opponentBenchedSlot,uint256 challengerScore,uint256 opponentScore,uint8 status,address winner,bool decisionLocked))",
  "function wins(address) view returns (uint256)",
  "function losses(address) view returns (uint256)",
  "event WarCreated(uint256 indexed warId,address indexed challenger,uint256 stake,uint256 matchday)",
];
const ORACLE = [
  "function postMatchdayResults(uint256,string[],uint8[],uint8[],uint8[],uint8[],uint8[],bool[])",
  "function matchdayFinalized(uint256) view returns (bool)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN);
  const env = fs.readFileSync(path.join(root, ".env"), "utf8");
  const pkRaw = (env.match(/PRIVATE_KEY=(.+)/) || [])[1].trim();
  const deployer = new ethers.Wallet(pkRaw.startsWith("0x") ? pkRaw : "0x" + pkRaw, provider);
  console.log(`Deployer (oracle owner): ${deployer.address}`);
  console.log(`Deployer ETH:  ${eth(await provider.getBalance(deployer.address))}`);
  const usdcD = new ethers.Contract(A.usdc, ERC20, deployer);
  console.log(`Deployer USDC: ${u6(await usdcD.balanceOf(deployer.address))}\n`);

  // ── 1. Generate / load 10 wallets ───────────────────────────────────────────
  const smokePath = path.join(root, ".env.smoke10");
  let keys;
  if (fs.existsSync(smokePath)) {
    keys = fs.readFileSync(smokePath, "utf8").trim().split("\n").map((l) => l.split("=")[1]);
    console.log(`Loaded ${keys.length} wallets from .env.smoke10`);
  } else {
    keys = Array.from({ length: N }, () => ethers.Wallet.createRandom().privateKey);
    fs.writeFileSync(smokePath, keys.map((k, i) => `PK_${i}=${k}`).join("\n") + "\n");
    console.log(`Generated ${N} fresh wallets -> .env.smoke10`);
  }
  const W = keys.map((k) => new ethers.Wallet(k, provider));
  W.forEach((w, i) => console.log(`  W${i}: ${w.address}`));

  // ── 2. Fund each wallet (ETH gas + 1 USDC), sequentially from deployer ───────
  console.log("\n━━ Funding wallets (ETH + USDC) ━━");
  let nonce = await provider.getTransactionCount(deployer.address);
  for (let i = 0; i < N; i++) {
    const bal = await provider.getBalance(W[i].address);
    if (bal < ETH_FUND / 2n) {
      await (await deployer.sendTransaction({ to: W[i].address, value: ETH_FUND, nonce: nonce++ })).wait();
    }
    const ub = await usdcD.balanceOf(W[i].address);
    if (ub < STAKE) {
      await (await usdcD.transfer(W[i].address, STAKE, { nonce: nonce++ })).wait();
    }
    process.stdout.write(`  W${i} funded\r`);
  }
  console.log("\n  ✓ all funded");

  // ── 3. Approve + mint squad (parallel across wallets) ───────────────────────
  console.log("\n━━ Approve USDC + mint squads ━━");
  await mapLimit(W, 3, async (w, i) => {
    const usdc = new ethers.Contract(A.usdc, ERC20, w);
    const nft = new ethers.Contract(A.nft, NFT, w);
    if ((await usdc.allowance(w.address, A.squadWars)) < STAKE)
      await withRetry(async () => (await usdc.approve(A.squadWars, STAKE)).wait(), `W${i} approve`);
    if (!(await nft.hasMinted(w.address)))
      await withRetry(async () => (await nft.mintSquad(SQUAD_IDS, SQUAD_POS)).wait(), `W${i} mintSquad`);
    console.log(`  ✓ W${i} approved + squad minted`);
  });

  // ── 4. 5 wars: create -> accept -> lock (parallel across the 5 pairs) ───────
  console.log("\n━━ Create / accept / lock 5 wars ━━");
  const pairs = [];
  for (let i = 0; i + 1 < N; i += 2) pairs.push([i, i + 1]);
  const warIds = await mapLimit(pairs, 3, async ([ai, bi]) => {
    const a = W[ai], b = W[bi];
    const warsA = new ethers.Contract(A.squadWars, WARS, a);
    const warsB = new ethers.Contract(A.squadWars, WARS, b);
    const rc = await withRetry(async () => (await warsA.createWar(MATCHDAY, STAKE)).wait(), `W${ai} createWar`);
    let warId = 0n;
    for (const lg of rc.logs) {
      try { const p = warsA.interface.parseLog(lg); if (p?.name === "WarCreated") warId = p.args.warId; } catch {}
    }
    await withRetry(async () => (await warsB.acceptWar(warId)).wait(), `W${bi} acceptWar`);
    await withRetry(async () => (await warsA.lockDecision(warId, CHALLENGER_CAPTAIN, CHALLENGER_BENCH)).wait(), `W${ai} lock`);
    await withRetry(async () => (await warsB.lockDecision(warId, OPPONENT_CAPTAIN, OPPONENT_BENCH)).wait(), `W${bi} lock`);
    console.log(`  ✓ War #${warId}: W${ai} (challenger) vs W${bi} (opponent)`);
    return warId;
  });

  // ── 5. Oracle posts matchday 1 results (finalizes it) ───────────────────────
  console.log("\n━━ Oracle posts matchday 1 ━━");
  const oracle = new ethers.Contract(A.oracle, ORACLE, deployer);
  if (await oracle.matchdayFinalized(MATCHDAY)) {
    console.log("  matchday 1 already finalized — skipping post");
  } else {
    const goals       = [0, 0, 0, 1, 2]; // bellingham 1, mbappe 2
    const assists     = [0, 0, 1, 0, 0]; // rodri 1
    const cleanSheets = [1, 1, 0, 0, 0]; // alisson, van_dijk
    const zeros       = [0, 0, 0, 0, 0];
    const played      = [true, true, true, true, true];
    await withRetry(async () => (await oracle.postMatchdayResults(
      MATCHDAY, SQUAD_IDS, goals, assists, cleanSheets, zeros, zeros, played
    )).wait(), "postMatchday");
    console.log("  ✓ posted + finalized matchday 1");
  }

  // ── 6. Resolve all wars (deployer pays gas), sequentially ───────────────────
  console.log("\n━━ Resolve wars ━━");
  const warsRead = new ethers.Contract(A.squadWars, WARS, deployer);
  const STATUS = ["Open", "Active", "Resolved", "Cancelled"];
  for (const warId of warIds) {
    const pre = await warsRead.getWar(warId);
    if (Number(pre.status) !== 2)
      await withRetry(async () => (await warsRead.resolveWar(warId)).wait(), `resolveWar ${warId}`);
  }

  // ── 7. Report ───────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━ RESULTS ━━━━━━━━━━━━━━");
  for (let k = 0; k < warIds.length; k++) {
    const w = await warsRead.getWar(warIds[k]);
    const [ai, bi] = pairs[k];
    const winLabel = w.winner === ethers.ZeroAddress ? "DRAW"
      : w.winner.toLowerCase() === W[ai].address.toLowerCase() ? `W${ai} (challenger)`
      : `W${bi} (opponent)`;
    console.log(`War #${warIds[k]}  status=${STATUS[Number(w.status)]}  ` +
      `score ${w.challengerScore}-${w.opponentScore}  winner=${winLabel}`);
  }
  console.log("\nReputation:");
  for (let i = 0; i < N; i++) {
    const wn = await warsRead.wins(W[i].address);
    const ls = await warsRead.losses(W[i].address);
    console.log(`  W${i}: ${wn}W / ${ls}L   USDC=${u6(await usdcD.balanceOf(W[i].address))}`);
  }
  console.log(`\nDeployer ETH left:  ${eth(await provider.getBalance(deployer.address))}`);
  console.log(`Deployer USDC left: ${u6(await usdcD.balanceOf(deployer.address))}`);
  console.log("\n✅ 10-wallet live smoke test complete.");
}

main().catch((e) => { console.error("\n❌", e.shortMessage || e.message || e); process.exitCode = 1; });
