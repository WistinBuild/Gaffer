/**
 * Local stress test — runs against the in-process Hardhat network (no --network flag).
 *
 * Deploys the full protocol against a mintable MockUSDC, then hammers it:
 *   - N managers each mint a squad
 *   - many marketplace mints (with approvals)
 *   - multiple matchday rounds of create → accept → lock → resolve wars
 *
 * Tracks tx count + gas per operation and asserts invariants. Reports throughput.
 */
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

const MANAGERS = 20;        // distinct wallets
const ROUNDS = 3;           // war matchdays
const MINTS_PER_MANAGER = 3;

const USDC = (n: number) => ethers.parseUnits(String(n), 6);
const FUND = USDC(10_000);
const STAKE = USDC(5);

// gas accounting
const gas: Record<string, { n: number; total: bigint }> = {};
function track(op: string, used: bigint) {
  if (!gas[op]) gas[op] = { n: 0, total: 0n };
  gas[op].n++;
  gas[op].total += used;
}
async function send(op: string, txPromise: Promise<any>) {
  const r = await (await txPromise).wait();
  track(op, r.gasUsed);
  return r;
}

const POS = [0, 1, 2, 3, 4]; // GK, DEF, MID, FWD, FLEX — valid formation (one GK)

async function main() {
  const t0 = Date.now();
  const signers = (await ethers.getSigners()).slice(0, MANAGERS);
  console.log(`Stress test — ${signers.length} managers, ${ROUNDS} war rounds, ${MINTS_PER_MANAGER} mints each\n`);

  // ── Players
  const playersPath = path.resolve(__dirname, "../../app/src/data/players.json");
  const players = JSON.parse(fs.readFileSync(playersPath, "utf-8")) as any[];
  const squadIds = players.slice(0, 5).map((p) => p.id);
  const marketIds = players.slice(0, 12).map((p) => p.id);

  // ── Deploy
  const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
  const oracle = await (await ethers.getContractFactory("Oracle")).deploy();
  const nft = await (await ethers.getContractFactory("GafferNFT")).deploy("ipfs://stress/");
  const wars = await (await ethers.getContractFactory("SquadWars")).deploy(
    await oracle.getAddress(), await nft.getAddress(), await usdc.getAddress());
  const market = await (await ethers.getContractFactory("PlayerMint")).deploy(
    "ipfs://stress/players/", await usdc.getAddress());
  await nft.setSquadWarsContract(await wars.getAddress());
  console.log("✓ Deployed Oracle / GafferNFT / SquadWars / PlayerMint + MockUSDC");

  // ── Seed marketplace catalog
  await market.setCatalogBatch(
    marketIds,
    marketIds.map(() => 3),
    marketIds.map(() => 90),
    marketIds.map(() => false),
    marketIds.map(() => USDC(2)),
    marketIds.map(() => 100000),
  );
  console.log(`✓ Catalog seeded with ${marketIds.length} players @ 2 USDC each`);

  const warsAddr = await wars.getAddress();
  const marketAddr = await market.getAddress();

  // ── Fund + approve every manager
  for (const s of signers) {
    await usdc.mint(s.address, FUND);
    await send("usdc.approve", usdc.connect(s).approve(warsAddr, ethers.MaxUint256));
    await send("usdc.approve", usdc.connect(s).approve(marketAddr, ethers.MaxUint256));
  }
  console.log(`✓ Funded ${signers.length} managers with 10,000 USDC each + approvals`);

  // ── Everyone mints a squad
  for (const s of signers) {
    await send("mintSquad", nft.connect(s).mintSquad(squadIds, POS));
  }
  console.log(`✓ ${signers.length} squads minted`);

  // ── Marketplace stress — each manager mints several players
  let mintCount = 0;
  for (const s of signers) {
    for (let i = 0; i < MINTS_PER_MANAGER; i++) {
      await send("mintPlayer", market.connect(s).mintPlayer(marketIds[i % marketIds.length]));
      mintCount++;
    }
  }
  console.log(`✓ ${mintCount} marketplace mints`);

  // ── War rounds: pair managers, create/accept/lock, post oracle, resolve
  let warsCreated = 0, resolved = 0, winners = 0, draws = 0;
  for (let round = 1; round <= ROUNDS; round++) {
    const matchday = round;
    const roundWarIds: bigint[] = [];

    for (let i = 0; i + 1 < signers.length; i += 2) {
      const a = signers[i], b = signers[i + 1];
      const rc = await send("createWar", wars.connect(a).createWar(matchday, STAKE));
      let warId = 0n;
      for (const lg of rc.logs) {
        try { const p = wars.interface.parseLog(lg); if (p?.name === "WarCreated") warId = p.args.warId; } catch {}
      }
      roundWarIds.push(warId);
      warsCreated++;
      await send("acceptWar", wars.connect(b).acceptWar(warId));
      // diverging captain picks so scores differ → real winners
      await send("lockDecision", wars.connect(a).lockDecision(warId, 3, 0));
      await send("lockDecision", wars.connect(b).lockDecision(warId, 1, 0));
    }

    // Oracle posts results for this matchday — vary by player so captains matter
    await send("postMatchday", oracle.postMatchdayResults(
      matchday,
      squadIds,
      squadIds.map((_, i) => (i === 3 ? 2 : i === 1 ? 1 : 0)), // goals
      squadIds.map(() => 0),                                    // assists
      squadIds.map((_, i) => (i === 0 ? 1 : 0)),                // clean sheets
      squadIds.map(() => 0),
      squadIds.map(() => 0),
      squadIds.map(() => true),
    ));

    for (const warId of roundWarIds) {
      await send("resolveWar", wars.resolveWar(warId));
      const w = await wars.getWar(warId);
      resolved++;
      if (w.winner === ethers.ZeroAddress) draws++; else winners++;
    }
    console.log(`✓ Round ${round}: ${roundWarIds.length} wars created → accepted → resolved`);
  }

  // ── Invariant checks
  const protocolBal = await usdc.balanceOf(warsAddr);   // only retained draw-fees should remain
  const totalMinted = await market.totalMinted();
  const ok =
    Number(totalMinted) === mintCount &&
    resolved === warsCreated;

  // ── Report
  const totalTx = Object.values(gas).reduce((a, g) => a + g.n, 0);
  const totalGas = Object.values(gas).reduce((a, g) => a + g.total, 0n);
  const secs = (Date.now() - t0) / 1000;

  console.log("\n──────────── gas by operation ────────────");
  for (const [op, g] of Object.entries(gas).sort((a, b) => Number(b[1].total - a[1].total))) {
    console.log(`  ${op.padEnd(16)} ${String(g.n).padStart(4)} txs   avg ${(g.total / BigInt(g.n)).toString().padStart(8)} gas`);
  }
  console.log("──────────────────────────────────────────");
  console.log(`  managers           ${signers.length}`);
  console.log(`  marketplace mints  ${mintCount}  (on-chain totalMinted=${totalMinted})`);
  console.log(`  wars               ${warsCreated} created · ${resolved} resolved · ${winners} winners · ${draws} draws`);
  console.log(`  protocol USDC bal  ${ethers.formatUnits(protocolBal, 6)} (retained draw fees)`);
  console.log(`  total txs          ${totalTx}`);
  console.log(`  total gas          ${totalGas.toString()}`);
  console.log(`  wall time          ${secs.toFixed(1)}s  (${(totalTx / secs).toFixed(1)} tx/s)`);
  console.log(`\n${ok ? "✅ PASS — all invariants held" : "❌ FAIL — invariant mismatch"}`);
  if (!ok) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
