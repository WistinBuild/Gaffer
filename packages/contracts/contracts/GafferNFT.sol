// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract GafferNFT is ERC721, Ownable {
    using Strings for uint256;

    // Positional roles
    uint8 public constant GK   = 0;
    uint8 public constant DEF  = 1;
    uint8 public constant MID  = 2;
    uint8 public constant FWD  = 3;
    uint8 public constant FLEX = 4;

    // Rarity tiers (based on tournament points)
    uint8 public constant BRONZE = 0;
    uint8 public constant SILVER = 1;
    uint8 public constant GOLD   = 2;
    uint8 public constant ICON   = 3;

    struct PlayerCard {
        string playerId;      // matches players.json id
        uint8  position;      // GK/DEF/MID/FWD/FLEX
        uint8  rarity;        // bronze/silver/gold/icon
        uint32 tournamentPts; // cumulative fantasy points
        uint8  goals;
        uint8  assists;
        uint8  cleanSheets;
    }

    uint256 private _nextTokenId = 1;
    string  private _baseTokenURI;

    mapping(uint256 => PlayerCard) public cards;
    mapping(address => bool) public hasMinted;
    mapping(address => uint256[5]) public squad; // wallet => [tokenId x5]

    address public squadWarsContract;

    event SquadMinted(address indexed owner, uint256[5] tokenIds);
    event StatsUpdated(uint256 indexed tokenId, uint32 newPoints);
    event RarityUpgraded(uint256 indexed tokenId, uint8 newRarity);

    modifier onlySquadWars() {
        require(msg.sender == squadWarsContract || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(string memory baseURI) ERC721("GafferNFT", "GAFFER") {
        _baseTokenURI = baseURI;
    }

    function mintSquad(
        string[5] calldata playerIds,
        uint8[5]  calldata positions
    ) external {
        require(!hasMinted[msg.sender], "Squad already minted");
        require(_validatePositions(positions), "Invalid formation");

        uint256[5] memory tokenIds;
        for (uint256 i = 0; i < 5; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(msg.sender, tokenId);

            cards[tokenId] = PlayerCard({
                playerId:      playerIds[i],
                position:      positions[i],
                rarity:        BRONZE,
                tournamentPts: 0,
                goals:         0,
                assists:       0,
                cleanSheets:   0
            });

            squad[msg.sender][i] = tokenId;
            tokenIds[i] = tokenId;
        }

        hasMinted[msg.sender] = true;
        emit SquadMinted(msg.sender, tokenIds);
    }

    function updateStats(
        uint256 tokenId,
        uint8   goals,
        uint8   assists,
        uint8   cleanSheets,
        uint32  pointsEarned
    ) external onlySquadWars {
        require(_exists(tokenId), "Token does not exist");

        PlayerCard storage card = cards[tokenId];
        card.goals       += goals;
        card.assists     += assists;
        card.cleanSheets += cleanSheets;
        card.tournamentPts += pointsEarned;

        uint8 newRarity = _calculateRarity(card.tournamentPts);
        if (newRarity > card.rarity) {
            card.rarity = newRarity;
            emit RarityUpgraded(tokenId, newRarity);
        }

        emit StatsUpdated(tokenId, card.tournamentPts);
    }

    function setSquadWarsContract(address _squadWars) external onlyOwner {
        squadWarsContract = _squadWars;
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function getSquad(address owner_) external view returns (uint256[5] memory) {
        return squad[owner_];
    }

    function getCard(uint256 tokenId) external view returns (PlayerCard memory) {
        require(_exists(tokenId), "Token does not exist");
        return cards[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString()));
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _calculateRarity(uint32 pts) internal pure returns (uint8) {
        if (pts >= 150) return ICON;
        if (pts >= 80)  return GOLD;
        if (pts >= 30)  return SILVER;
        return BRONZE;
    }

    function _validatePositions(uint8[5] calldata positions) internal pure returns (bool) {
        bool hasGK = false;
        for (uint256 i = 0; i < 5; i++) {
            require(positions[i] <= FLEX, "Invalid position");
            if (positions[i] == GK) {
                require(!hasGK, "Only one GK allowed");
                hasGK = true;
            }
        }
        return hasGK;
    }

}
