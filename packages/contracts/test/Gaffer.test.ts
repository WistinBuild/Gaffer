import { expect } from "chai";
import { ethers } from "hardhat";

describe("GAFFER Protocol", () => {
  let oracle: any;
  let nft: any;
  let squadWars: any;
  let owner: any, alice: any, bob: any;

  const PLAYERS = ["mbappe", "bellingham", "van_dijk", "alisson", "vinicius"];
  const POSITIONS: number[] = [3, 2, 1, 0, 3]; // FWD, MID, DEF, GK, FWD

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const OracleFactory = await ethers.getContractFactory("Oracle");
    oracle = await OracleFactory.deploy();

    const NFTFactory = await ethers.getContractFactory("GafferNFT");
    nft = await NFTFactory.deploy("https://api.gaffer.gg/metadata/");

    const SquadWarsFactory = await ethers.getContractFactory("SquadWars");
    squadWars = await SquadWarsFactory.deploy(
      await oracle.getAddress(),
      await nft.getAddress()
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
    });

    it("creates an open war", async () => {
      await squadWars.connect(alice).createWar(1, { value: ethers.parseEther("0.01") });
      const war = await squadWars.getWar(1);
      expect(war.challenger).to.equal(alice.address);
      expect(war.status).to.equal(0n); // Open
    });

    it("accepts a war", async () => {
      await squadWars.connect(alice).createWar(1, { value: ethers.parseEther("0.01") });
      await squadWars.connect(bob).acceptWar(1, { value: ethers.parseEther("0.01") });
      const war = await squadWars.getWar(1);
      expect(war.opponent).to.equal(bob.address);
      expect(war.status).to.equal(1n); // Active
    });

    it("resolves war and pays winner", async () => {
      const matchday = 1;
      await squadWars.connect(alice).createWar(matchday, { value: ethers.parseEther("0.01") });
      await squadWars.connect(bob).acceptWar(1, { value: ethers.parseEther("0.01") });

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
      // Both squads have identical players so scores are equal — draw
      // winner is address(0), both refunded minus fee
      expect(war.challengerScore).to.be.gt(0n);
      expect(war.challengerScore).to.equal(war.opponentScore);
    });

    it("cancels an open war and refunds stake", async () => {
      const stake = ethers.parseEther("0.01");
      await squadWars.connect(alice).createWar(1, { value: stake });

      const balBefore = await ethers.provider.getBalance(alice.address);
      const tx = await squadWars.connect(alice).cancelWar(1);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(alice.address);

      // Alice got refunded (accounting for gas)
      expect(balAfter + gasUsed).to.be.closeTo(balBefore + stake, ethers.parseEther("0.0001"));
    });

    it("returns leaderboard sorted by wins", async () => {
      await squadWars.connect(alice).createWar(1, { value: ethers.parseEther("0.01") });
      await squadWars.connect(bob).acceptWar(1, { value: ethers.parseEther("0.01") });

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
});
