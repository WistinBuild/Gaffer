// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title PlayerMint
 * @notice Individual player NFTs with on-chain catalog of prices + scarcity.
 *         Catalog seeded by owner; anyone can mint any player at its set price.
 */
contract PlayerMint is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    struct PlayerMeta {
        uint8  position;     // 0=GK, 1=DEF, 2=MID, 3=FWD, 4=FLEX
        uint16 rating;       // 0-99
        bool   isLegend;
        uint96 priceWei;
        uint32 maxSupply;
        uint32 minted;
        bool   exists;
    }

    struct TokenInfo {
        string  playerId;
        uint8   position;
        uint16  rating;
        bool    isLegend;
        uint32  mintedAt;
    }

    mapping(string => PlayerMeta) private _catalog;
    mapping(uint256 => TokenInfo) private _tokens;
    mapping(address => uint256[]) private _ownerTokens;

    uint256 private _nextTokenId = 1;
    string  private _baseTokenURI;

    event CatalogSet(string indexed playerId, uint96 priceWei, uint32 maxSupply);
    event PlayerMinted(address indexed buyer, string playerId, uint256 indexed tokenId, uint96 paid);

    constructor(string memory baseURI) ERC721("GafferPlayerNFT", "GPLAYER") {
        _baseTokenURI = baseURI;
    }

    // ─── Catalog (owner only) ───────────────────────────────────────────────

    function setCatalogEntry(
        string calldata playerId,
        uint8   position,
        uint16  rating,
        bool    isLegend,
        uint96  priceWei,
        uint32  supplyCap
    ) external onlyOwner {
        PlayerMeta storage m = _catalog[playerId];
        m.position  = position;
        m.rating    = rating;
        m.isLegend  = isLegend;
        m.priceWei  = priceWei;
        m.maxSupply = supplyCap;
        m.exists    = true;
        emit CatalogSet(playerId, priceWei, supplyCap);
    }

    function setCatalogBatch(
        string[] calldata playerIds,
        uint8[]  calldata positions,
        uint16[] calldata ratings,
        bool[]   calldata isLegends,
        uint96[] calldata pricesWei,
        uint32[] calldata supplyCaps
    ) external onlyOwner {
        uint256 n = playerIds.length;
        require(
            n == positions.length &&
            n == ratings.length &&
            n == isLegends.length &&
            n == pricesWei.length &&
            n == supplyCaps.length,
            "Length mismatch"
        );
        for (uint256 i = 0; i < n; i++) {
            PlayerMeta storage m = _catalog[playerIds[i]];
            m.position  = positions[i];
            m.rating    = ratings[i];
            m.isLegend  = isLegends[i];
            m.priceWei  = pricesWei[i];
            m.maxSupply = supplyCaps[i];
            m.exists    = true;
            emit CatalogSet(playerIds[i], pricesWei[i], supplyCaps[i]);
        }
    }

    // ─── Mint ───────────────────────────────────────────────────────────────

    function mintPlayer(string calldata playerId) external payable nonReentrant returns (uint256) {
        PlayerMeta storage m = _catalog[playerId];
        require(m.exists, "Player not in catalog");
        require(msg.value >= m.priceWei, "Insufficient payment");
        require(m.minted < m.maxSupply, "Sold out");

        m.minted++;
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        _tokens[tokenId] = TokenInfo({
            playerId:  playerId,
            position:  m.position,
            rating:    m.rating,
            isLegend:  m.isLegend,
            mintedAt:  uint32(block.timestamp)
        });
        _ownerTokens[msg.sender].push(tokenId);

        // Refund overpayment
        if (msg.value > m.priceWei) {
            payable(msg.sender).transfer(msg.value - m.priceWei);
        }

        emit PlayerMinted(msg.sender, playerId, tokenId, m.priceWei);
        return tokenId;
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function catalogOf(string calldata playerId) external view returns (PlayerMeta memory) {
        return _catalog[playerId];
    }

    function tokensOf(address user) external view returns (uint256[] memory) {
        return _ownerTokens[user];
    }

    function tokenInfo(uint256 tokenId) external view returns (TokenInfo memory) {
        require(_exists(tokenId), "Token does not exist");
        return _tokens[tokenId];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    function withdraw(address payable to) external onlyOwner {
        to.transfer(address(this).balance);
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString()));
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
