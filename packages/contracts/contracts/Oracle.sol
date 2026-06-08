// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
// OZ v4 — Ownable constructor takes no args; owner is msg.sender by default

contract Oracle is Ownable {
    enum WorldCupStage { Group, RoundOf16, QuarterFinal, SemiFinal, Final }

    struct MatchdayResult {
        uint256 matchday;
        mapping(string => PlayerStats) playerStats;
        bool finalized;
    }

    struct PlayerStats {
        uint8 goals;
        uint8 assists;
        uint8 cleanSheets;
        uint8 yellowCards;
        uint8 redCards;
        bool played;
    }

    WorldCupStage public currentStage;
    uint256 public currentMatchday;
    mapping(uint256 => mapping(string => PlayerStats)) public results; // matchday => playerId => stats
    mapping(uint256 => bool) public matchdayFinalized;

    // Stage multipliers scaled by 100 (100 = 1.0x, 150 = 1.5x)
    mapping(WorldCupStage => uint256) public stageMultiplier;

    event MatchdayPosted(uint256 indexed matchday);
    event StageAdvanced(WorldCupStage newStage);

    constructor() {
        stageMultiplier[WorldCupStage.Group] = 100;
        stageMultiplier[WorldCupStage.RoundOf16] = 120;
        stageMultiplier[WorldCupStage.QuarterFinal] = 150;
        stageMultiplier[WorldCupStage.SemiFinal] = 200;
        stageMultiplier[WorldCupStage.Final] = 300;
        currentStage = WorldCupStage.Group;
        currentMatchday = 1;
    }

    function postMatchdayResults(
        uint256 matchday,
        string[] calldata playerIds,
        uint8[] calldata goals,
        uint8[] calldata assists,
        uint8[] calldata cleanSheets,
        uint8[] calldata yellowCards,
        uint8[] calldata redCards,
        bool[] calldata played
    ) external onlyOwner {
        require(!matchdayFinalized[matchday], "Matchday already finalized");
        require(playerIds.length == goals.length, "Array length mismatch");

        for (uint256 i = 0; i < playerIds.length; i++) {
            results[matchday][playerIds[i]] = PlayerStats({
                goals: goals[i],
                assists: assists[i],
                cleanSheets: cleanSheets[i],
                yellowCards: yellowCards[i],
                redCards: redCards[i],
                played: played[i]
            });
        }

        matchdayFinalized[matchday] = true;
        if (matchday >= currentMatchday) {
            currentMatchday = matchday + 1;
        }

        emit MatchdayPosted(matchday);
    }

    function advanceStage(WorldCupStage newStage) external onlyOwner {
        require(uint8(newStage) > uint8(currentStage), "Can only advance forward");
        currentStage = newStage;
        emit StageAdvanced(newStage);
    }

    function getPlayerStats(uint256 matchday, string calldata playerId)
        external view returns (PlayerStats memory)
    {
        return results[matchday][playerId];
    }

    function getCurrentMultiplier() external view returns (uint256) {
        return stageMultiplier[currentStage];
    }

    function calculatePoints(uint256 matchday, string calldata playerId, uint8 position)
        external view returns (uint256 points)
    {
        PlayerStats memory stats = results[matchday][playerId];
        if (!stats.played) return 0;

        // position: 0=GK, 1=DEF, 2=MID, 3=FWD, 4=FLEX
        if (position == 0) { // GK
            points += stats.cleanSheets * 12;
            points += stats.goals * 10;
            points += stats.assists * 6;
        } else if (position == 1) { // DEF
            points += stats.cleanSheets * 8;
            points += stats.goals * 8;
            points += stats.assists * 6;
        } else if (position == 2) { // MID
            points += stats.goals * 8;
            points += stats.assists * 6;
            points += stats.cleanSheets * 4;
        } else if (position == 3) { // FWD
            points += stats.goals * 10;
            points += stats.assists * 4;
        } else { // FLEX
            points += stats.goals * 8;
            points += stats.assists * 5;
        }

        if (stats.redCards > 0) points = points > 4 ? points - 4 : 0;

        // Apply stage multiplier
        points = (points * stageMultiplier[currentStage]) / 100;
    }
}
