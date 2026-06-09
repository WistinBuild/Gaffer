import { expect } from "chai";
import { ethers } from "hardhat";

describe("GAFFER Protocol", () => {
  let oracle: any;
  let nft: any;
  let squadWars: any;
  let usdc: any;
  let owner: any, alice: any, bob: any;

  const PLAYERS = ["mbappe", "bellingham", "van_dijk", "alisson", "vinicius"];
  const POSITIONS: number[] = [3, 2, 1, 0, 3]; // FWD, MID, DEF, GK, FWD

  const STAKE = ethers.parseUnits("10", 6);     // 10 USDC (6 decimals)
  const FUND  = ethers.parseUnits("1000", 6);   // seed each wallet

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();
    await usdc.mint(alice.address, FUND);
    await usdc.mint(bob.address, FUND);

    const OracleFactory = await ethers.getContractFactory("Oracle");
    oracle = await OracleFactory.deploy();

    const NFTFactory = await ethers.getContractFactory("GafferNFT");
    nft = await NFTFactory.deploy("https://api.gaffer.gg/metadata/");

    const SquadWarsFactory = await ethers.getContractFactory("SquadWars");
    squadWars = await SquadWarsFactory.deploy(
      await oracle.getAddress(),
      await nft.getAddress(),
      await usdc.getAddress()
    );

    await nft.setSquadWarsContract(await squadWars.getAddress());
  });

  // ─── Oracle ────────────────────────────────────────────────────────────────

  describe("Oracle", () => {
    it("posts matchday results and calculates points", async () => {
      await oracle.postMatchdayResults(
        1,
        ["mbappe"],
        [2], [1], [0], [0], [0], [true]
      );

      const pts = await oracle.calculatePoints(1, "mbappe", 3); // FWD
      // 2 goals * 10 + 1 assist * 4 = 24, * 1.0x stage = 24
      expect(pts).to.equal(24n);
    });

    it("applies stage multipliers", async () => {
      await oracle.postMatchdayResults(
        1, ["bellingham"], [1], [0], [0], [0], [0], [true]
      );

      await oracle.advanceStage(2); // QuarterFinal = 1.5x
      const pts = await oracle.calculatePoints(1, "bellingham", 2); // MID
      // 1 goal * 8 = 8, * 1.5x = 12
      expect(pts).to.equal(12n);
    });

    it("returns 0 for players who did not play", async () => {
      await oracle.postMatchdayResults(
        1, ["injured"], [0], [0], [0], [0], [0], [false]
      );
      const pts = await oracle.calculatePoints(1, "injured", 3);
      expect(pts).to.equal(0n);
    });
  });

  // ─── GafferNFT ─────────────────────────────────────────────────────────────

  describe("GafferNFT", () => {
    it("mints a 5-player squad", async () => {
      await nft.connect(alice).mintSquad(PLAYERS, POSITIONS);
      const squad = await nft.getSquad(alice.address);
      expect(squad.length).to.equal(5);
      expect(squad[0]).to.equal(1n);
    });

    it("prevents double minting", async () => {
      await nft.connect(alice).mintSquad(PLAYERS, POSITIONS);
      await expect(
        nft.connect(alice).mintSquad(PLAYERS, POSITIONS)
      ).to.be.revertedWith("Squad already minted");
    });

    it("requires exactly one GK", async () => {
      const noGK: number[] = [3, 2, 1, 2, 3];
      await expect(
        nft.connect(alice).mintSquad(PLAYERS, noGK)
      ).to.be.revertedWith("Invalid formation");
    });

    it("upgrades rarity at point thresholds", async () => {
      await nft.connect(alice).mintSquad(PLAYERS, POSITIONS);
      const squad = await nft.getSquad(alice.address);
      const tokenId = squad[0];

      await nft.connect(owner).updateStats(tokenId, 3, 0, 0, 31);
      const card = await nft.getCard(tokenId);
      expect(card.rarity).to.equal(1n); // SILVER
    });
  });

  // ─── SquadWars ─────────────────────────────────────────────────────────────

  describe("SquadWars", () => {
    beforeEach(async () => {
      await nft.connect(alice).mintSquad(PLAYERS, POSITIONS);
      await nft.connect(bob).mintSquad(PLAYERS, POSITIONS);
      // Approve the protocol to pull USDC stakes
      await usdc.connect(alice).approve(await squadWars.getAddress(), FUND);
      await usdc.connect(bob).approve(await squadWars.getAddress(), FUND);
    });

    it("creates an open war", async () => {
      await squadWars.connect(alice).createWar(1, STAKE);
      const war = await squadWars.getWar(1);
      expect(war.challenger).to.equal(alice.address);
      expect(war.stake).to.equal(STAKE);
      expect(war.status).to.equal(0n); // Open
    });

    it("rejects a stake below the minimum", async () => {
      await expect(
        squadWars.connect(alice).createWar(1, 999n)
      ).to.be.revertedWith("Stake too low");
    });

    it("accepts a war and escrows both stakes", async () => {
      await squadWars.connect(alice).createWar(1, STAKE);
      await squadWars.connect(bob).acceptWar(1);
      const war = await squadWars.getWar(1);
      expect(war.opponent).to.equal(bob.address);
      expect(war.status).to.equal(1n); // Active
      expect(await usdc.balanceOf(await squadWars.getAddress())).to.equal(STAKE * 2n);
    });

    it("resolves war and settles the pot", async () => {
      const matchday = 1;
      await squadWars.connect(alice).createWar(matchday, STAKE);
      await squadWars.connect(bob).acceptWar(1);

      await oracle.postMatchdayResults(
        matchday,
        PLAYERS,
        [2, 1, 0, 0, 1],
        [1, 0, 0, 0, 0],
        [0, 0, 1, 1, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [true, true, true, true, true]
      );

      await squadWars.resolveWar(1);
      const war = await squadWars.getWar(1);
      expect(war.status).to.equal(2n); // Resolved
      // Both squads have identical players so scores are equal — draw, both refunded
      expect(war.challengerScore).to.be.gt(0n);
      expect(war.challengerScore).to.equal(war.opponentScore);
      // Draw refunds both sides and sweeps the fee to the owner — nothing is left stuck
      expect(await usdc.balanceOf(await squadWars.getAddress())).to.equal(0n);
    });

    it("cancels an open war and refunds the USDC stake", async () => {
      const balBefore = await usdc.balanceOf(alice.address);
      await squadWars.connect(alice).createWar(1, STAKE);
      expect(await usdc.balanceOf(alice.address)).to.equal(balBefore - STAKE);

      await squadWars.connect(alice).cancelWar(1);
      expect(await usdc.balanceOf(alice.address)).to.equal(balBefore);
    });

    it("returns leaderboard sorted by wins", async () => {
      await squadWars.connect(alice).createWar(1, STAKE);
      await squadWars.connect(bob).acceptWar(1);

      await oracle.postMatchdayResults(
        1, PLAYERS,
        [2, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 0, 1, 1, 0],
        [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [true, true, true, true, true]
      );
      await squadWars.resolveWar(1);

      const [managers] = await squadWars.getLeaderboard(10);
      expect(managers[0]).to.be.oneOf([alice.address, bob.address]);
    });
  });

  // ─── PlayerMint (USDC marketplace) ──────────────────────────────────────────

  describe("PlayerMint", () => {
    let market: any;
    const PRICE = ethers.parseUnits("5", 6); // 5 USDC

    beforeEach(async () => {
      const Factory = await ethers.getContractFactory("PlayerMint");
      market = await Factory.deploy("https://api.gaffer.gg/players/", await usdc.getAddress());
      await market.setCatalogEntry("mbappe", 3, 91, false, PRICE, 1000);
    });

    it("mints a player against an approved USDC balance", async () => {
      await usdc.connect(alice).approve(await market.getAddress(), PRICE);
      await market.connect(alice).mintPlayer("mbappe");

      expect(await market.balanceOf(alice.address)).to.equal(1n);
      expect(await usdc.balanceOf(await market.getAddress())).to.equal(PRICE);
    });

    it("reverts without approval", async () => {
      await expect(market.connect(alice).mintPlayer("mbappe")).to.be.reverted;
    });

    it("lets the owner withdraw collected USDC", async () => {
      await usdc.connect(alice).approve(await market.getAddress(), PRICE);
      await market.connect(alice).mintPlayer("mbappe");

      const before = await usdc.balanceOf(owner.address);
      await market.connect(owner).withdraw(owner.address);
      expect(await usdc.balanceOf(owner.address)).to.equal(before + PRICE);
    });
  });
});
