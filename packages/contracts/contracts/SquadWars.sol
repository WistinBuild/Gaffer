// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Oracle.sol";
import "./GafferNFT.sol";

contract SquadWars is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    Oracle     public oracle;
    GafferNFT  public nft;
    IERC20     public usdc;          // payment token (6 decimals)

    uint256 public constant MIN_STAKE      = 1_000;  // 0.001 USDC (6 decimals)
    uint256 public constant PROTOCOL_FEE   = 50;     // 5% scaled by 1000
    uint256 private _nextWarId = 1;

    enum WarStatus { Open, Active, Resolved, Cancelled }

    struct War {
        uint256 id;
        address challenger;
        address opponent;
        uint256 stake;          // per side (USDC, 6 decimals)
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

    // tokenId => matchday => whether this card's stats were already credited
    mapping(uint256 => mapping(uint256 => bool)) private _credited;

    event WarCreated(uint256 indexed warId, address indexed challenger, uint256 stake, uint256 matchday);
    event WarAccepted(uint256 indexed warId, address indexed opponent);
    event DecisionLocked(uint256 indexed warId, address indexed manager, uint8 captain, uint8 benched);
    event WarResolved(uint256 indexed warId, address indexed winner, uint256 payout);
    event WarCancelled(uint256 indexed warId);

    constructor(address _oracle, address _nft, address _usdc) {
        oracle = Oracle(_oracle);
        nft    = GafferNFT(_nft);
        usdc   = IERC20(_usdc);
    }

    /// @notice Create a war. Caller must have approved `stake` USDC to this contract first.
    function createWar(uint256 matchday, uint256 stake) external nonReentrant {
        require(stake >= MIN_STAKE, "Stake too low");
        require(nft.hasMinted(msg.sender), "No squad minted");
        require(!oracle.matchdayFinalized(matchday), "Matchday already over");

        usdc.safeTransferFrom(msg.sender, address(this), stake);

        uint256 warId = _nextWarId++;
        wars[warId] = War({
            id:                  warId,
            challenger:          msg.sender,
            opponent:            address(0),
            stake:               stake,
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
        emit WarCreated(warId, msg.sender, stake, matchday);
    }

    /// @notice Accept an open war. Caller must have approved the war's stake in USDC first.
    function acceptWar(uint256 warId) external nonReentrant {
        War storage war = wars[warId];
        require(war.status == WarStatus.Open, "War not open");
        require(war.challenger != msg.sender, "Cannot fight yourself");
        require(nft.hasMinted(msg.sender), "No squad minted");
        require(!oracle.matchdayFinalized(war.matchday), "Matchday already over");

        usdc.safeTransferFrom(msg.sender, address(this), war.stake);

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

        // Persist each playing card's matchday stats + tournament points so
        // rarity actually forges. Deduped per (token, matchday) so a manager
        // with multiple wars on the same matchday is never double-credited.
        _creditSquad(war.challenger, war.matchday, war.benchedSlot);
        _creditSquad(war.opponent,   war.matchday, war.opponentBenchedSlot);

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
            // Draw: refund both sides their share minus the protocol fee,
            // and sweep the fee (plus any rounding dust) to the owner so it
            // is never stranded in the contract.
            uint256 refund = (totalPot - fee) / 2;
            war.status = WarStatus.Resolved;
            usdc.safeTransfer(war.challenger, refund);
            usdc.safeTransfer(war.opponent, refund);
            usdc.safeTransfer(owner(), totalPot - 2 * refund);
            emit WarResolved(warId, address(0), refund);
            return;
        }

        war.status = WarStatus.Resolved;
        usdc.safeTransfer(war.winner, winnerPot);
        usdc.safeTransfer(owner(), fee);

        emit WarResolved(warId, war.winner, winnerPot);
    }

    function cancelWar(uint256 warId) external nonReentrant {
        War storage war = wars[warId];
        require(war.status == WarStatus.Open, "War not open");
        require(war.challenger == msg.sender || msg.sender == owner(), "Not authorized");

        war.status = WarStatus.Cancelled;
        usdc.safeTransfer(war.challenger, war.stake);
        emit WarCancelled(warId);
    }

    /// @notice Owner-only recovery for a war that can no longer settle — e.g. its
    ///         matchday was never finalized by the Oracle. Refunds the staked USDC
    ///         to both sides (challenger only if the war was still Open).
    function adminCancelWar(uint256 warId) external onlyOwner nonReentrant {
        War storage war = wars[warId];
        require(
            war.status == WarStatus.Open || war.status == WarStatus.Active,
            "Not cancellable"
        );
        bool wasActive = war.status == WarStatus.Active;
        war.status = WarStatus.Cancelled;

        usdc.safeTransfer(war.challenger, war.stake);
        if (wasActive) {
            usdc.safeTransfer(war.opponent, war.stake);
        }
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

        // Partial selection — only `limit` passes (O(total * limit)) instead of a
        // full O(total^2) sort, so requesting a small top-N stays cheap.
        address[] memory sorted = _allManagers;
        for (uint256 i = 0; i < limit; i++) {
            uint256 best = i;
            for (uint256 j = i + 1; j < total; j++) {
                if (wins[sorted[j]] > wins[sorted[best]]) best = j;
            }
            if (best != i) {
                (sorted[i], sorted[best]) = (sorted[best], sorted[i]);
            }
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

    /// @dev Push each playing card's matchday performance into the NFT (forges rarity).
    ///      Deduped per (token, matchday) to prevent double-counting across wars.
    function _creditSquad(address manager, uint256 matchday, uint8 benchedSlot) internal {
        uint256[5] memory squadTokens = nft.getSquad(manager);

        for (uint8 i = 0; i < 5; i++) {
            if (i == benchedSlot) continue;

            uint256 tokenId = squadTokens[i];
            if (_credited[tokenId][matchday]) continue;
            _credited[tokenId][matchday] = true;

            GafferNFT.PlayerCard memory card = nft.getCard(tokenId);
            Oracle.PlayerStats memory stats = oracle.getPlayerStats(matchday, card.playerId);
            if (!stats.played) continue;

            uint256 pts = oracle.calculatePoints(matchday, card.playerId, card.position);
            nft.updateStats(tokenId, stats.goals, stats.assists, stats.cleanSheets, uint32(pts));
        }
    }

    function _trackManager(address manager) internal {
        if (!_isManager[manager]) {
            _isManager[manager] = true;
            _allManagers.push(manager);
        }
    }
}
