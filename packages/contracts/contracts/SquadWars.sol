// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./Oracle.sol";
import "./GafferNFT.sol";

contract SquadWars is Ownable, ReentrancyGuard {
    Oracle     public oracle;
    GafferNFT  public nft;

    uint256 public constant MIN_STAKE      = 0.001 ether;
    uint256 public constant PROTOCOL_FEE   = 50;  // 5% scaled by 1000
    uint256 private _nextWarId = 1;

    enum WarStatus { Open, Active, Resolved, Cancelled }

    struct War {
        uint256 id;
        address challenger;
        address opponent;
        uint256 stake;          // per side
        uint256 matchday;
        uint8   captainSlot;    // index 0-4 in squad (2x points)
        uint8   benchedSlot;    // index 0-4 in squad (0 points)
        uint8   opponentCaptainSlot;
        uint8   opponentBenchedSlot;
        uint256 challengerScore;
        uint256 opponentScore;
        WarStatus status;
        address winner;
        bool decisionLocked;    // captain/bench locked
    }

    mapping(uint256 => War) public wars;
    mapping(address => uint256[]) public activeWars;
    mapping(address => uint256) public wins;
    mapping(address => uint256) public losses;

    address[] private _allManagers;
    mapping(address => bool) private _isManager;

    event WarCreated(uint256 indexed warId, address indexed challenger, uint256 stake, uint256 matchday);
    event WarAccepted(uint256 indexed warId, address indexed opponent);
    event DecisionLocked(uint256 indexed warId, address indexed manager, uint8 captain, uint8 benched);
    event WarResolved(uint256 indexed warId, address indexed winner, uint256 payout);
    event WarCancelled(uint256 indexed warId);

    constructor(address _oracle, address _nft) {
        oracle = Oracle(_oracle);
        nft    = GafferNFT(_nft);
    }

    function createWar(uint256 matchday) external payable {
        require(msg.value >= MIN_STAKE, "Stake too low");
        require(nft.hasMinted(msg.sender), "No squad minted");
        require(!oracle.matchdayFinalized(matchday), "Matchday already over");

        uint256 warId = _nextWarId++;
        wars[warId] = War({
            id:                  warId,
            challenger:          msg.sender,
            opponent:            address(0),
            stake:               msg.value,
            matchday:            matchday,
            captainSlot:         0,
            benchedSlot:         4,
            opponentCaptainSlot: 0,
            opponentBenchedSlot: 4,
            challengerScore:     0,
            opponentScore:       0,
            status:              WarStatus.Open,
            winner:              address(0),
            decisionLocked:      false
        });

        _trackManager(msg.sender);
        activeWars[msg.sender].push(warId);
        emit WarCreated(warId, msg.sender, msg.value, matchday);
    }

    function acceptWar(uint256 warId) external payable {
        War storage war = wars[warId];
        require(war.status == WarStatus.Open, "War not open");
        require(war.challenger != msg.sender, "Cannot fight yourself");
        require(msg.value == war.stake, "Wrong stake amount");
        require(nft.hasMinted(msg.sender), "No squad minted");
        require(!oracle.matchdayFinalized(war.matchday), "Matchday already over");

        war.opponent = msg.sender;
        war.status   = WarStatus.Active;

        _trackManager(msg.sender);
        activeWars[msg.sender].push(warId);
        emit WarAccepted(warId, msg.sender);
    }

    function lockDecision(uint256 warId, uint8 captainSlot, uint8 benchedSlot) external {
        War storage war = wars[warId];
        require(war.status == WarStatus.Active, "War not active");
        require(!oracle.matchdayFinalized(war.matchday), "Matchday locked");
        require(captainSlot < 5 && benchedSlot < 5, "Invalid slot");
        require(captainSlot != benchedSlot, "Captain and bench must differ");

        if (msg.sender == war.challenger) {
            war.captainSlot = captainSlot;
            war.benchedSlot = benchedSlot;
        } else if (msg.sender == war.opponent) {
            war.opponentCaptainSlot = captainSlot;
            war.opponentBenchedSlot = benchedSlot;
        } else {
            revert("Not in this war");
        }

        emit DecisionLocked(warId, msg.sender, captainSlot, benchedSlot);
    }

    function resolveWar(uint256 warId) external nonReentrant {
        War storage war = wars[warId];
        require(war.status == WarStatus.Active, "War not active");
        require(oracle.matchdayFinalized(war.matchday), "Matchday not finalized");

        war.challengerScore = _calculateScore(
            war.challenger, war.matchday, war.captainSlot, war.benchedSlot
        );
        war.opponentScore = _calculateScore(
            war.opponent, war.matchday, war.opponentCaptainSlot, war.opponentBenchedSlot
        );

        uint256 totalPot  = war.stake * 2;
        uint256 fee       = (totalPot * PROTOCOL_FEE) / 1000;
        uint256 winnerPot = totalPot - fee;

        if (war.challengerScore > war.opponentScore) {
            war.winner = war.challenger;
            wins[war.challenger]++;
            losses[war.opponent]++;
        } else if (war.opponentScore > war.challengerScore) {
            war.winner = war.opponent;
            wins[war.opponent]++;
            losses[war.challenger]++;
        } else {
            // Draw: refund both minus fee split
            uint256 refund = (totalPot - fee) / 2;
            payable(war.challenger).transfer(refund);
            payable(war.opponent).transfer(refund);
            war.status = WarStatus.Resolved;
            emit WarResolved(warId, address(0), refund);
            return;
        }

        war.status = WarStatus.Resolved;
        payable(war.winner).transfer(winnerPot);
        payable(owner()).transfer(fee);

        emit WarResolved(warId, war.winner, winnerPot);
    }

    function cancelWar(uint256 warId) external {
        War storage war = wars[warId];
        require(war.status == WarStatus.Open, "War not open");
        require(war.challenger == msg.sender || msg.sender == owner(), "Not authorized");

        war.status = WarStatus.Cancelled;
        payable(war.challenger).transfer(war.stake);
        emit WarCancelled(warId);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getOpenWars() external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i < _nextWarId; i++) {
            if (wars[i].status == WarStatus.Open) count++;
        }
        uint256[] memory openIds = new uint256[](count);
        uint256 idx;
        for (uint256 i = 1; i < _nextWarId; i++) {
            if (wars[i].status == WarStatus.Open) openIds[idx++] = i;
        }
        return openIds;
    }

    function getLeaderboard(uint256 limit) external view returns (address[] memory managers, uint256[] memory winCounts) {
        uint256 total = _allManagers.length;
        if (limit > total) limit = total;

        managers  = new address[](limit);
        winCounts = new uint256[](limit);

        // Simple insertion sort for top-N (fine for hackathon scale)
        address[] memory sorted = _allManagers;
        for (uint256 i = 0; i < total; i++) {
            for (uint256 j = i + 1; j < total; j++) {
                if (wins[sorted[j]] > wins[sorted[i]]) {
                    address tmp = sorted[i];
                    sorted[i] = sorted[j];
                    sorted[j] = tmp;
                }
            }
        }

        for (uint256 i = 0; i < limit; i++) {
            managers[i]  = sorted[i];
            winCounts[i] = wins[sorted[i]];
        }
    }

    function getWar(uint256 warId) external view returns (War memory) {
        return wars[warId];
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _calculateScore(
        address manager,
        uint256 matchday,
        uint8   captainSlot,
        uint8   benchedSlot
    ) internal view returns (uint256 total) {
        uint256[5] memory squadTokens = nft.getSquad(manager);

        for (uint8 i = 0; i < 5; i++) {
            if (i == benchedSlot) continue;

            uint256 tokenId = squadTokens[i];
            GafferNFT.PlayerCard memory card = nft.getCard(tokenId);
            uint256 pts = oracle.calculatePoints(matchday, card.playerId, card.position);

            if (i == captainSlot) pts *= 2;
            total += pts;
        }
    }

    function _trackManager(address manager) internal {
        if (!_isManager[manager]) {
            _isManager[manager] = true;
            _allManagers.push(manager);
        }
    }
}
