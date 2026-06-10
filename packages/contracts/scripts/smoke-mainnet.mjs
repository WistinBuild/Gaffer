/**
 * Minimal end-to-end smoke test against the LIVE Base MAINNET deployment.
 * Designed to cost almost nothing (gas only — stakes/fees/mint revenue all
 * flow back to the deployer/treasury) and to NOT pollute real game state:
 *   - uses an isolated sentinel matchday (50), far from real WC2026 MDs 1–8
 *   - 2 throwaway wallets, keys saved to .env.smoke-mainnet (gitignored) so a
 *     re-run reuses them and no funds get stranded.
 *
 * Covers the user-facing flows:
 *   1. PlayerMint — mint a real player NFT with USDC (the flywheel revenue input)
 *   2. Squad Wars — mint squad → create → accept → lock → oracle → resolve → payout
 *   3. Metadata — tokenURI resolves on gaffer.games
 *   4. Sweeps leftover USDC back to the deployer.
 *
 * Run:  node scripts/smoke-mainnet.mjs
 */
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Public mainnet.base.org rate-limits bursts hard; use a more permissive public
// endpoint for this script (the app itself still uses mainnet.base.org).
const RPC = process.env.RPC_URL || "https://base-rpc.publicnode.com";
const CHAIN = 8453;
const MATCHDAY = 50;                              // sentinel — isolated from real MDs
const STAKE = ethers.parseUnits("0.1", 6);        // 0.1 USDC per side
const ETH_FUND = ethers.parseEther("0.0004");     // gas per wallet
const PLAYER_ID = "alisson";                      // cheap catalog player to mint

const A = {
  oracle:    "0x4A0ab5e7c1CBAB89478a73164BeFc6A2B33b2191",
  nft:       "0x3d8c115be697ad89f5A177690C5e47b5E50eAEE2",
  squadWars: "0xc654546738f1Af5df5B055Dfb3a8515C0F738DDa",
  playerMint:"0x20b53C016Eca430fc38Cae42904f85c4aDAA880A",
  usdc:      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

const SQUAD_IDS = ["alisson", "van_dijk", "rodri", "bellingham", "mbappe"];
const SQUAD_POS = [0, 1, 2, 2, 3];                 // GK, DEF, MID, MID, FWD
const CHALLENGER_CAPTAIN = 4, CHALLENGER_BENCH = 0; // doubles mbappe, benches GK → wins
const OPPONENT_CAPTAIN   = 0, OPPONENT_BENCH   = 4; // doubles GK, benches mbappe → loses

const u6 = (v) => ethers.formatUnits(v, 6);
const eth = (v) => ethers.formatEther(v);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label, tries = 6) {
  let last;
  for (let t = 1; t <= tries; t++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      const msg = e.shortMessage || e.message || String(e);
      if (/already known|nonce too low|replacement/.test(msg)) throw e;
      await sleep(900 * t);
    }
  }
  throw new Error(`${label} failed after ${tries} tries: ${last?.shortMessage || last?.message}`);
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
  "function tokenURI(uint256) view returns (string)",
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
];
const PLAYERMINT = [
  "function mintPlayer(string) returns (uint256)",
  "function catalogOf(string) view returns (tuple(uint8 position,uint8 rating,bool legend,uint256 priceUSDC,uint256 maxSupply,uint256 minted,bool exists))",
  "function tokensOf(address) view returns (uint256[])",
  "function tokenURI(uint256) view returns (string)",
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
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

const tokenIdFromReceipt = (iface, rc, to) => {
  for (const lg of rc.logs) {
    try { const p = iface.parseLog(lg);
      if (p?.name === "Transfer" && p.args.to.toLowerCase() === to.toLowerCase()) return p.args.tokenId;
    } catch {}
  }
  return null;
};

async function checkURI(label, uri) {
  if (!uri) { console.log(`  ${label}: (no tokenId)`); return; }
  const url = uri.startsWith("http") ? uri : uri;
  try {
    const r = await fetch(url, { method: "GET" });
    const ok = r.ok;
    let name = "";
    try { const j = await r.json(); name = j?.name || ""; } catch {}
    console.log(`  ${label}: ${url}  → HTTP ${r.status}${ok ? ` ✓ ${name}` : " ✗"}`);
  } catch (e) {
    console.log(`  ${label}: ${url}  → fetch error ${e.message}`);
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN);
  const env = fs.readFileSync(path.join(root, ".env"), "utf8");
  const pkRaw = (env.match(/PRIVATE_KEY=(.+)/) || [])[1].trim();
  const deployer = new ethers.Wallet(pkRaw.startsWith("0x") ? pkRaw : "0x" + pkRaw, provider);
  const usdcD = new ethers.Contract(A.usdc, ERC20, deployer);

  console.log(`Network: Base mainnet (${CHAIN})`);
  console.log(`Deployer (oracle owner): ${deployer.address}`);
  console.log(`Deployer ETH:  ${eth(await provider.getBalance(deployer.address))}`);
  console.log(`Deployer USDC: ${u6(await usdcD.balanceOf(deployer.address))}\n`);

  // ── 1. Load / generate 2 throwaway wallets ──────────────────────────────────
  const smokePath = path.join(root, ".env.smoke-mainnet");
  let keys;
  if (fs.existsSync(smokePath)) {
    keys = fs.readFileSync(smokePath, "utf8").trim().split("\n").filter(Boolean).map((l) => l.split("=")[1]);
    console.log(`Loaded ${keys.length} wallets from .env.smoke-mainnet`);
  } else {
    keys = Array.from({ length: 2 }, () => ethers.Wallet.createRandom().privateKey);
    fs.writeFileSync(smokePath, keys.map((k, i) => `PK_${i}=${k}`).join("\n") + "\n");
    console.log(`Generated 2 fresh wallets -> .env.smoke-mainnet`);
  }
  const W = keys.map((k) => new ethers.Wallet(k, provider));
  W.forEach((w, i) => console.log(`  W${i}: ${w.address}`));

  // ── 2. Fund wallets (ETH gas + USDC) ────────────────────────────────────────
  // W0 also mints a player → needs stake + player price; W1 needs just the stake.
  const playerPrice = (await new ethers.Contract(A.playerMint, PLAYERMINT, provider).catalogOf(PLAYER_ID)).priceUSDC;
  const usdcNeed = [STAKE + playerPrice + ethers.parseUnits("0.02", 6), STAKE + ethers.parseUnits("0.01", 6)];
  console.log(`\n━━ Funding wallets ━━  (player ${PLAYER_ID} = ${u6(playerPrice)} USDC)`);
  let nonce = await provider.getTransactionCount(deployer.address);
  for (let i = 0; i < W.length; i++) {
    if (await provider.getBalance(W[i].address) < ETH_FUND / 2n)
      await (await deployer.sendTransaction({ to: W[i].address, value: ETH_FUND, nonce: nonce++ })).wait();
    const ub = await usdcD.balanceOf(W[i].address);
    if (ub < usdcNeed[i])
      await (await usdcD.transfer(W[i].address, usdcNeed[i] - ub, { nonce: nonce++ })).wait();
    console.log(`  ✓ W${i} funded  (ETH+${u6(usdcNeed[i])} USDC)`);
  }

  // ── 3. Approve + mint squads ────────────────────────────────────────────────
  console.log("\n━━ Approve USDC + mint squads ━━");
  const squadTokenIds = [];
  for (let i = 0; i < W.length; i++) {
    const usdc = new ethers.Contract(A.usdc, ERC20, W[i]);
    const nft = new ethers.Contract(A.nft, NFT, W[i]);
    const allow = await withRetry(() => usdc.allowance(W[i].address, A.squadWars), `W${i} allowance`);
    if (allow < STAKE)
      await withRetry(async () => (await usdc.approve(A.squadWars, STAKE)).wait(), `W${i} approve wars`);
    if (!(await withRetry(() => nft.hasMinted(W[i].address), `W${i} hasMinted`))) {
      const rc = await withRetry(async () => (await nft.mintSquad(SQUAD_IDS, SQUAD_POS)).wait(), `W${i} mintSquad`);
      squadTokenIds[i] = tokenIdFromReceipt(nft.interface, rc, W[i].address);
    }
    console.log(`  ✓ W${i} squad ready  (tokenId ${squadTokenIds[i] ?? "—"})`);
    await sleep(400);
  }

  // ── 4. PlayerMint revenue path (W0 mints a real player NFT) ──────────────────
  console.log("\n━━ PlayerMint (flywheel revenue path) ━━");
  let playerTokenId = null, playerURI = null;
  {
    const usdc = new ethers.Contract(A.usdc, ERC20, W[0]);
    const pm = new ethers.Contract(A.playerMint, PLAYERMINT, W[0]);
    const already = await pm.tokensOf(W[0].address);
    if (already.length > 0) {
      playerTokenId = already[already.length - 1];
      console.log(`  W0 already holds a player NFT (tokenId ${playerTokenId}) — skipping mint`);
    } else {
      if ((await usdc.allowance(W[0].address, A.playerMint)) < playerPrice)
        await withRetry(async () => (await usdc.approve(A.playerMint, playerPrice)).wait(), "W0 approve playerMint");
      const rc = await withRetry(async () => (await pm.mintPlayer(PLAYER_ID)).wait(), "W0 mintPlayer");
      playerTokenId = tokenIdFromReceipt(pm.interface, rc, W[0].address);
      if (playerTokenId == null) { const t = await pm.tokensOf(W[0].address); playerTokenId = t[t.length - 1]; }
      console.log(`  ✓ W0 minted '${PLAYER_ID}' → tokenId ${playerTokenId}  (paid ${u6(playerPrice)} USDC)`);
    }
    playerURI = playerTokenId != null ? await pm.tokenURI(playerTokenId) : null;
  }

  // ── 5. One war: create → accept → lock ──────────────────────────────────────
  console.log("\n━━ Squad War: create / accept / lock ━━");
  const warsA = new ethers.Contract(A.squadWars, WARS, W[0]);
  const warsB = new ethers.Contract(A.squadWars, WARS, W[1]);
  const rc = await withRetry(async () => (await warsA.createWar(MATCHDAY, STAKE)).wait(), "createWar");
  let warId = 0n;
  for (const lg of rc.logs) { try { const p = warsA.interface.parseLog(lg); if (p?.name === "WarCreated") warId = p.args.warId; } catch {} }
  await withRetry(async () => (await warsB.acceptWar(warId)).wait(), "acceptWar");
  await withRetry(async () => (await warsA.lockDecision(warId, CHALLENGER_CAPTAIN, CHALLENGER_BENCH)).wait(), "W0 lock");
  await withRetry(async () => (await warsB.lockDecision(warId, OPPONENT_CAPTAIN, OPPONENT_BENCH)).wait(), "W1 lock");
  console.log(`  ✓ War #${warId}: W0 (challenger) vs W1 (opponent), stake ${u6(STAKE)} USDC each`);

  // ── 6. Oracle posts the sentinel matchday ───────────────────────────────────
  console.log(`\n━━ Oracle posts matchday ${MATCHDAY} ━━`);
  const oracle = new ethers.Contract(A.oracle, ORACLE, deployer);
  if (await oracle.matchdayFinalized(MATCHDAY)) {
    console.log("  already finalized — skipping post");
  } else {
    const goals = [0, 0, 0, 1, 2], assists = [0, 0, 1, 0, 0], cleanSheets = [1, 1, 0, 0, 0];
    const zeros = [0, 0, 0, 0, 0], played = [true, true, true, true, true];
    await withRetry(async () => (await oracle.postMatchdayResults(MATCHDAY, SQUAD_IDS, goals, assists, cleanSheets, zeros, zeros, played)).wait(), "postMatchday");
    console.log(`  ✓ posted + finalized matchday ${MATCHDAY}`);
  }

  // ── 7. Resolve ──────────────────────────────────────────────────────────────
  console.log("\n━━ Resolve ━━");
  const warsRead = new ethers.Contract(A.squadWars, WARS, deployer);
  if (Number((await warsRead.getWar(warId)).status) !== 2)
    await withRetry(async () => (await warsRead.resolveWar(warId)).wait(), "resolveWar");
  const w = await warsRead.getWar(warId);
  const STATUS = ["Open", "Active", "Resolved", "Cancelled"];
  const winLabel = w.winner === ethers.ZeroAddress ? "DRAW"
    : w.winner.toLowerCase() === W[0].address.toLowerCase() ? "W0 (challenger)" : "W1 (opponent)";
  console.log(`  War #${warId}  status=${STATUS[Number(w.status)]}  score ${w.challengerScore}-${w.opponentScore}  winner=${winLabel}`);

  // ── 8. Metadata resolves on gaffer.games ────────────────────────────────────
  console.log("\n━━ Metadata (gaffer.games) ━━");
  await checkURI("player NFT ", playerURI);
  if (squadTokenIds[0]) await checkURI("squad  NFT ", await new ethers.Contract(A.nft, NFT, provider).tokenURI(squadTokenIds[0]));

  // ── 9. Report + sweep USDC back to deployer ─────────────────────────────────
  console.log("\n━━ Reputation + balances ━━");
  for (let i = 0; i < W.length; i++) {
    console.log(`  W${i}: ${await warsRead.wins(W[i].address)}W / ${await warsRead.losses(W[i].address)}L   USDC=${u6(await usdcD.balanceOf(W[i].address))}`);
  }
  console.log("\n━━ Sweeping leftover USDC back to deployer ━━");
  for (let i = 0; i < W.length; i++) {
    const usdc = new ethers.Contract(A.usdc, ERC20, W[i]);
    const bal = await usdc.balanceOf(W[i].address);
    if (bal > 0n) {
      await withRetry(async () => (await usdc.transfer(deployer.address, bal)).wait(), `W${i} sweep`);
      console.log(`  ✓ W${i} swept ${u6(bal)} USDC back`);
    }
  }

  console.log(`\nDeployer ETH left:  ${eth(await provider.getBalance(deployer.address))}`);
  console.log(`Deployer USDC left: ${u6(await usdcD.balanceOf(deployer.address))}`);
  console.log("\n✅ Mainnet smoke test complete.");
  console.log("Note: PlayerMint revenue sits in the PlayerMint contract (owner-withdrawable). Throwaway wallet ETH dust is reusable on re-run.");
}

main().catch((e) => { console.error("\n❌", e.shortMessage || e.message || e); process.exitCode = 1; });
