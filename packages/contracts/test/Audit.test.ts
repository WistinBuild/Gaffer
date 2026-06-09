import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * Exhaustive coverage of every external function + edge case / revert path.
 * Complements Gaffer.test.ts (happy paths). Uses MockUSDC for payments.
 */
describe("GAFFER — full function coverage", () => {
  let oracle: any, nft: any, wars: any, market: any, usdc: any;
  let owner: any, alice: any, bob: any, carol: any;

  const PLAYERS = ["mbappe", "bellingham", "van_dijk", "alisson", "vinicius"];
  const POS: number[] = [3, 2, 1, 0, 3]; // FWD MID DEF GK FWD
  const STAKE = ethers.parseUnits("10", 6);
  const FUND = ethers.parseUnits("1000", 6);

  async function approveAll(signer: any) {
    await usdc.connect(signer).approve(await wars.getAddress(), ethers.MaxUint256);
    await usdc.connect(signer).approve(await market.getAddress(), ethers.MaxUint256);
  }

  beforeEach(async () => {
    [owner, alice, bob, carol] = await ethers.getSigners();

    usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    for (const s of [owner, alice, bob, carol]) await usdc.mint(s.address, FUND);

    oracle = await (await ethers.getContractFactory("Oracle")).deploy();
    nft = await (await ethers.getContractFactory("GafferNFT")).deploy("ipfs://meta/");
    wars = await (await ethers.getContractFactory("SquadWars")).deploy(
      await oracle.getAddress(), await nft.getAddress(), await usdc.getAddress());
    market = await (await ethers.getContractFactory("PlayerMint")).deploy(
      "ipfs://players/", await usdc.getAddress());
    await nft.setSquadWarsContract(await wars.getAddress());

    for (const s of [owner, alice, bob, carol]) await approveAll(s);
  });

  // ─── Oracle ────────────────────────────────────────────────────────────────
  describe("Oracle", () => {
    it("advances stage forward and reflects the multiplier", async () => {
      expect(await oracle.getCurrentMultiplier()).to.equal(100n);
      await oracle.advanceStage(2); // QuarterFinal 1.5x
      expect(await oracle.currentStage()).to.equal(2n);
      expect(await oracle.getCurrentMultiplier()).to.equal(150n);
    });

    it("refuses to advance backward or sideways", async () => {
      await oracle.advanceStage(3);
      await expect(oracle.advanceStage(2)).to.be.revertedWith("Can only advance forward");
      await expect(oracle.advanceStage(3)).to.be.revertedWith("Can only advance forward");
    });

    it("only owner can post results / advance stage", async () => {
      await expect(
        oracle.connect(alice).postMatchdayResults(1, ["x"], [0], [0], [0], [0], [0], [true]),
      ).to.be.reverted;
      await expect(oracle.connect(alice).advanceStage(1)).to.be.reverted;
    });

    it("prevents double-finalizing a matchday and advances currentMatchday", async () => {
      await oracle.postMatchdayResults(1, ["mbappe"], [1], [0], [0], [0], [0], [true]);
      expect(await oracle.matchdayFinalized(1)).to.equal(true);
      expect(await oracle.currentMatchday()).to.equal(2n);
      await expect(
        oracle.postMatchdayResults(1, ["mbappe"], [1], [0], [0], [0], [0], [true]),
      ).to.be.revertedWith("Matchday already finalized");
    });

    it("exposes posted player stats and applies red-card penalty", async () => {
      await oracle.postMatchdayResults(1, ["x"], [1], [0], [0], [0], [1], [true]); // 1 goal, 1 red
      const s = await oracle.getPlayerStats(1, "x");
      expect(s.goals).to.equal(1n);
      expect(s.redCards).to.equal(1n);
      // FWD: 1 goal*10 = 10, red card -4 => 6
      expect(await oracle.calculatePoints(1, "x", 3)).to.equal(6n);
    });
  });

  // ─── GafferNFT ───────────────────────────────────────────────────────────────
  describe("GafferNFT", () => {
    it("blocks updateStats from non-authorized callers", async () => {
      await nft.connect(alice).mintSquad(PLAYERS, POS);
      const [tok] = await nft.getSquad(alice.address);
      await expect(nft.connect(bob).updateStats(tok, 1, 0, 0, 10)).to.be.revertedWith("Not authorized");
      // owner is allowed
      await nft.connect(owner).updateStats(tok, 1, 0, 0, 10);
    });

    it("walks rarity Bronze→Silver→Gold→Icon at thresholds", async () => {
      await nft.connect(alice).mintSquad(PLAYERS, POS);
      const [tok] = await nft.getSquad(alice.address);
      expect((await nft.getCard(tok)).rarity).to.equal(0n);
      await nft.updateStats(tok, 0, 0, 0, 30);  // Silver
      expect((await nft.getCard(tok)).rarity).to.equal(1n);
      await nft.updateStats(tok, 0, 0, 0, 50);  // 80 -> Gold
      expect((await nft.getCard(tok)).rarity).to.equal(2n);
      await nft.updateStats(tok, 0, 0, 0, 70);  // 150 -> Icon
      expect((await nft.getCard(tok)).rarity).to.equal(3n);
    });

    it("getCard / tokenURI revert for nonexistent tokens; tokenURI composes baseURI", async () => {
      await expect(nft.getCard(999)).to.be.revertedWith("Token does not exist");
      await expect(nft.tokenURI(999)).to.be.revertedWith("Token does not exist");
      await nft.connect(alice).mintSquad(PLAYERS, POS);
      expect(await nft.tokenURI(1)).to.equal("ipfs://meta/1");
    });

    it("setBaseURI is owner-only and updates tokenURI", async () => {
      await nft.connect(alice).mintSquad(PLAYERS, POS);
      await expect(nft.connect(alice).setBaseURI("x://")).to.be.reverted;
      await nft.setBaseURI("https://new/");
      expect(await nft.tokenURI(1)).to.equal("https://new/1");
    });

    it("rejects an invalid formation (no GK)", async () => {
      await expect(nft.connect(alice).mintSquad(PLAYERS, [3, 2, 1, 2, 3])).to.be.revertedWith("Invalid formation");
    });

    it("rejects two goalkeepers", async () => {
      await expect(nft.connect(alice).mintSquad(PLAYERS, [0, 0, 1, 2, 3])).to.be.revertedWith("Only one GK allowed");
    });
  });

  // ─── SquadWars ───────────────────────────────────────────────────────────────
  describe("SquadWars", () => {
    beforeEach(async () => {
      await nft.connect(alice).mintSquad(PLAYERS, POS);
      await nft.connect(bob).mintSquad(PLAYERS, POS);
    });

    it("createWar revert paths: low stake / no squad / finalized matchday", async () => {
      await expect(wars.connect(alice).createWar(1, 999n)).to.be.revertedWith("Stake too low");
      await expect(wars.connect(carol).createWar(1, STAKE)).to.be.revertedWith("No squad minted");
      await oracle.postMatchdayResults(7, ["mbappe"], [1], [0], [0], [0], [0], [true]);
      await expect(wars.connect(alice).createWar(7, STAKE)).to.be.revertedWith("Matchday already over");
    });

    it("acceptWar revert paths: not open / self / no squad", async () => {
      await wars.connect(alice).createWar(1, STAKE);
      await expect(wars.connect(alice).acceptWar(1)).to.be.revertedWith("Cannot fight yourself");
      await expect(wars.connect(carol).acceptWar(1)).to.be.revertedWith("No squad minted");
      await wars.connect(bob).acceptWar(1);
      await expect(wars.connect(bob).acceptWar(1)).to.be.revertedWith("War not open");
    });

    it("lockDecision validates slots, participants, and distinctness", async () => {
      await wars.connect(alice).createWar(1, STAKE);
      await wars.connect(bob).acceptWar(1);
      await expect(wars.connect(alice).lockDecision(1, 5, 0)).to.be.revertedWith("Invalid slot");
      await expect(wars.connect(alice).lockDecision(1, 2, 2)).to.be.revertedWith("Captain and bench must differ");
      await expect(wars.connect(carol).lockDecision(1, 1, 0)).to.be.revertedWith("Not in this war");
      await wars.connect(alice).lockDecision(1, 4, 3);
    });

    it("resolveWar requires an active, finalized war", async () => {
      await expect(wars.resolveWar(1)).to.be.revertedWith("War not active");
      await wars.connect(alice).createWar(1, STAKE);
      await wars.connect(bob).acceptWar(1);
      await expect(wars.resolveWar(1)).to.be.revertedWith("Matchday not finalized");
    });

    it("pays the winner 95% and the owner the 5% fee", async () => {
      // alice captains the FWD that scores; bob captains the GK that doesn't
      await wars.connect(alice).createWar(1, STAKE);
      await wars.connect(bob).acceptWar(1);
      await wars.connect(alice).lockDecision(1, 0, 3); // captain FWD(mbappe slot0), bench GK
      await wars.connect(bob).lockDecision(1, 3, 0);   // captain GK, bench FWD
      await oracle.postMatchdayResults(1, PLAYERS, [3, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [true, true, true, true, true]);

      const ownerBefore = await usdc.balanceOf(owner.address);
      const aliceBefore = await usdc.balanceOf(alice.address);
      await wars.resolveWar(1);

      const pot = STAKE * 2n;
      const fee = (pot * 50n) / 1000n;
      const w = await wars.getWar(1);
      expect(w.winner).to.equal(alice.address);
      expect(await usdc.balanceOf(alice.address)).to.equal(aliceBefore + (pot - fee));
      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBefore + fee);
      expect(await usdc.balanceOf(await wars.getAddress())).to.equal(0n);
      expect(await wars.wins(alice.address)).to.equal(1n);
      expect(await wars.losses(bob.address)).to.equal(1n);
    });

    it("draw refunds both sides AND sweeps the fee to the owner (no stuck funds)", async () => {
      await wars.connect(alice).createWar(1, STAKE);
      await wars.connect(bob).acceptWar(1);
      // identical squads + identical captain/bench => identical scores => draw
      await oracle.postMatchdayResults(1, PLAYERS, [1, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 0, 1, 1, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [true, true, true, true, true]);
      const ownerBefore = await usdc.balanceOf(owner.address);
      await wars.resolveWar(1);
      const w = await wars.getWar(1);
      expect(w.winner).to.equal(ethers.ZeroAddress);
      const pot = STAKE * 2n;
      const fee = (pot * 50n) / 1000n;
      // owner received the swept fee; contract holds nothing
      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBefore + fee);
      expect(await usdc.balanceOf(await wars.getAddress())).to.equal(0n);
    });

    it("cancelWar refunds the challenger and is access-controlled", async () => {
      await wars.connect(alice).createWar(1, STAKE);
      await expect(wars.connect(bob).cancelWar(1)).to.be.revertedWith("Not authorized");
      const before = await usdc.balanceOf(alice.address);
      await wars.connect(alice).cancelWar(1);
      expect(await usdc.balanceOf(alice.address)).to.equal(before + STAKE);
      await expect(wars.connect(alice).cancelWar(1)).to.be.revertedWith("War not open");
    });

    it("getOpenWars lists only open wars", async () => {
      await wars.connect(alice).createWar(1, STAKE);
      await wars.connect(bob).createWar(1, STAKE);
      await wars.connect(bob).acceptWar(1); // war 1 -> active
      const open = await wars.getOpenWars();
      expect(open.map((x: bigint) => Number(x))).to.deep.equal([2]);
    });
  });

  // ─── PlayerMint ──────────────────────────────────────────────────────────────
  describe("PlayerMint", () => {
    const PRICE = ethers.parseUnits("3", 6);
    beforeEach(async () => {
      await market.setCatalogEntry("mbappe", 3, 91, false, PRICE, 2);
    });

    it("setCatalogEntry / setCatalogBatch are owner-only; batch validates lengths", async () => {
      await expect(
        market.connect(alice).setCatalogEntry("x", 0, 80, false, PRICE, 10),
      ).to.be.reverted;
      await expect(
        market.setCatalogBatch(["a", "b"], [0], [80], [false], [PRICE], [10]),
      ).to.be.revertedWith("Length mismatch");
    });

    it("mints, tracks ownership, and enforces the supply cap", async () => {
      await market.connect(alice).mintPlayer("mbappe");
      await market.connect(bob).mintPlayer("mbappe");
      expect(await market.totalMinted()).to.equal(2n);
      expect((await market.tokensOf(alice.address)).length).to.equal(1);
      expect((await market.tokenInfo(1)).playerId).to.equal("mbappe");
      // cap is 2 -> third mint sold out
      await expect(market.connect(carol).mintPlayer("mbappe")).to.be.revertedWith("Sold out");
    });

    it("reverts for unknown player and without approval", async () => {
      await expect(market.connect(alice).mintPlayer("nobody")).to.be.revertedWith("Player not in catalog");
      await usdc.connect(carol).approve(await market.getAddress(), 0);
      await expect(market.connect(carol).mintPlayer("mbappe")).to.be.reverted; // ERC20 allowance
    });

    it("owner withdraws collected USDC; non-owner cannot", async () => {
      await market.connect(alice).mintPlayer("mbappe");
      await expect(market.connect(alice).withdraw(alice.address)).to.be.reverted;
      const before = await usdc.balanceOf(owner.address);
      await market.withdraw(owner.address);
      expect(await usdc.balanceOf(owner.address)).to.equal(before + PRICE);
      expect(await usdc.balanceOf(await market.getAddress())).to.equal(0n);
    });
  });

  // ─── Audit fixes ─────────────────────────────────────────────────────────────
  describe("audit fixes", () => {
    beforeEach(async () => {
      await nft.connect(alice).mintSquad(PLAYERS, POS);
      await nft.connect(bob).mintSquad(PLAYERS, POS);
      await nft.connect(carol).mintSquad(PLAYERS, POS);
    });

    it("adminCancelWar recovers a stuck Active war — refunds both sides (owner only)", async () => {
      await wars.connect(alice).createWar(99, STAKE); // matchday that will never finalize
      await wars.connect(bob).acceptWar(1);
      const aBefore = await usdc.balanceOf(alice.address);
      const bBefore = await usdc.balanceOf(bob.address);

      await expect(wars.connect(alice).adminCancelWar(1)).to.be.reverted; // not owner
      await wars.adminCancelWar(1);

      expect(await usdc.balanceOf(alice.address)).to.equal(aBefore + STAKE);
      expect(await usdc.balanceOf(bob.address)).to.equal(bBefore + STAKE);
      expect(await usdc.balanceOf(await wars.getAddress())).to.equal(0n);
      expect((await wars.getWar(1)).status).to.equal(3n); // Cancelled
      await expect(wars.adminCancelWar(1)).to.be.revertedWith("Not cancellable");
    });

    it("adminCancelWar on an Open war refunds only the challenger", async () => {
      await wars.connect(alice).createWar(99, STAKE);
      const aBefore = await usdc.balanceOf(alice.address);
      await wars.adminCancelWar(1);
      expect(await usdc.balanceOf(alice.address)).to.equal(aBefore + STAKE);
      expect(await usdc.balanceOf(await wars.getAddress())).to.equal(0n);
    });

    it("squad NFTs are soulbound — transfers revert", async () => {
      const [tok] = await nft.getSquad(alice.address);
      await expect(
        nft.connect(alice).transferFrom(alice.address, bob.address, tok),
      ).to.be.revertedWith("Squad NFTs are soulbound");
    });

    it("Oracle rejects mismatched stat-array lengths", async () => {
      await expect(
        oracle.postMatchdayResults(1, ["a", "b"], [1, 0], [0], [0, 0], [0, 0], [0, 0], [true, true]),
      ).to.be.revertedWith("Array length mismatch");
    });

    it("resolveWar now forges cards (tournamentPts accrue) and dedupes per matchday", async () => {
      // Two wars on the SAME matchday both involving alice
      await wars.connect(alice).createWar(1, STAKE);
      await wars.connect(bob).acceptWar(1);
      await wars.connect(alice).createWar(1, STAKE);
      await wars.connect(carol).acceptWar(2);

      // mbappe (slot0, FWD) scores 2 goals → 20 base pts at Group stage
      await oracle.postMatchdayResults(1, PLAYERS, [2, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [true, true, true, true, true]);

      const [aliceTok] = await nft.getSquad(alice.address);
      expect((await nft.getCard(aliceTok)).tournamentPts).to.equal(0n);

      await wars.resolveWar(1);
      const afterFirst = (await nft.getCard(aliceTok)).tournamentPts;
      expect(afterFirst).to.equal(20n); // 2 goals * 10, Group 1.0x

      // Resolving the second war (same matchday, same card) must NOT double-credit
      await wars.resolveWar(2);
      expect((await nft.getCard(aliceTok)).tournamentPts).to.equal(afterFirst);
    });
  });
});
