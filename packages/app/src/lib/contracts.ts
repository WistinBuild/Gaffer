import { Address } from "viem";

// ─── Deployed Addresses ───────────────────────────────────────────────────────
export const CONTRACT_ADDRESSES = {
  oracle: (process.env.NEXT_PUBLIC_ORACLE_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as Address,
  gafferNFT: (process.env.NEXT_PUBLIC_NFT_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as Address,
  squadWars: (process.env.NEXT_PUBLIC_SQUAD_WARS_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as Address,
  playerMint: (process.env.NEXT_PUBLIC_PLAYER_MINT_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as Address,
};

// ─── Oracle ABI ───────────────────────────────────────────────────────────────
export const ORACLE_ABI = [
  {
    name: "postMatchdayResults",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchday", type: "uint256" },
      { name: "playerIds", type: "string[]" },
      { name: "goals", type: "uint8[]" },
      { name: "assists", type: "uint8[]" },
      { name: "cleanSheets", type: "uint8[]" },
      { name: "yellowCards", type: "uint8[]" },
      { name: "redCards", type: "uint8[]" },
      { name: "played", type: "bool[]" },
    ],
    outputs: [],
  },
  {
    name: "calculatePoints",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "matchday", type: "uint256" },
      { name: "playerId", type: "string" },
      { name: "position", type: "uint8" },
    ],
    outputs: [{ name: "points", type: "uint256" }],
  },
  {
    name: "advanceStage",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "stage", type: "uint8" }],
    outputs: [],
  },
  {
    name: "matchdayFinalized",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "matchday", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "currentStage",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

// ─── GafferNFT ABI ────────────────────────────────────────────────────────────
export const GAFFER_NFT_ABI = [
  {
    name: "mintSquad",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "playerIds", type: "string[5]" },
      { name: "positions", type: "uint8[5]" },
    ],
    outputs: [],
  },
  {
    name: "getSquad",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner_", type: "address" }],
    outputs: [{ name: "", type: "uint256[5]" }],
  },
  {
    name: "getCard",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "playerId", type: "string" },
          { name: "position", type: "uint8" },
          { name: "rarity", type: "uint8" },
          { name: "tournamentPts", type: "uint32" },
          { name: "goals", type: "uint8" },
          { name: "assists", type: "uint8" },
          { name: "cleanSheets", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "hasMinted",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "setSquadWarsContract",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_squadWars", type: "address" }],
    outputs: [],
  },
  {
    name: "squad",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "SquadMinted",
    type: "event",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "tokenIds", type: "uint256[5]", indexed: false },
    ],
  },
] as const;

// ─── SquadWars ABI ────────────────────────────────────────────────────────────
export const SQUAD_WARS_ABI = [
  {
    name: "createWar",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "matchday", type: "uint256" }],
    outputs: [],
  },
  {
    name: "acceptWar",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "warId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "lockDecision",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "warId", type: "uint256" },
      { name: "captainSlot", type: "uint8" },
      { name: "benchedSlot", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "resolveWar",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "warId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelWar",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "warId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getWar",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "warId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "challenger", type: "address" },
          { name: "opponent", type: "address" },
          { name: "stake", type: "uint256" },
          { name: "matchday", type: "uint256" },
          { name: "captainSlot", type: "uint8" },
          { name: "benchedSlot", type: "uint8" },
          { name: "opponentCaptainSlot", type: "uint8" },
          { name: "opponentBenchedSlot", type: "uint8" },
          { name: "challengerScore", type: "uint256" },
          { name: "opponentScore", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "winner", type: "address" },
          { name: "decisionLocked", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getOpenWars",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getLeaderboard",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "limit", type: "uint256" }],
    outputs: [
      { name: "managers", type: "address[]" },
      { name: "winCounts", type: "uint256[]" },
    ],
  },
  {
    name: "wins",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "losses",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "MIN_STAKE",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "WarCreated",
    type: "event",
    inputs: [
      { name: "warId", type: "uint256", indexed: true },
      { name: "challenger", type: "address", indexed: true },
      { name: "stake", type: "uint256", indexed: false },
      { name: "matchday", type: "uint256", indexed: false },
    ],
  },
  {
    name: "WarResolved",
    type: "event",
    inputs: [
      { name: "warId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
] as const;

// ─── Position mapping (matches contract constants) ────────────────────────────
export const POSITION_NUM: Record<string, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
  FLEX: 4,
};

export const POSITION_LABEL: Record<number, string> = {
  0: "GK",
  1: "DEF",
  2: "MID",
  3: "FWD",
  4: "FLEX",
};

export const RARITY_LABEL: Record<number, string> = {
  0: "BRONZE",
  1: "SILVER",
  2: "GOLD",
  3: "ICON",
};

export const WAR_STATUS_LABEL: Record<number, string> = {
  0: "Open",
  1: "Active",
  2: "Resolved",
  3: "Cancelled",
};

// ─── PlayerMint ABI (individual player NFTs with on-chain catalog) ───────────
export const PLAYER_MINT_ABI = [
  {
    name: "mintPlayer",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "playerId", type: "string" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    name: "catalogOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "playerId", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "position",  type: "uint8" },
          { name: "rating",    type: "uint16" },
          { name: "isLegend",  type: "bool" },
          { name: "priceWei",  type: "uint96" },
          { name: "maxSupply", type: "uint32" },
          { name: "minted",    type: "uint32" },
          { name: "exists",    type: "bool" },
        ],
      },
    ],
  },
  {
    name: "tokensOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "tokenInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "playerId", type: "string" },
          { name: "position", type: "uint8" },
          { name: "rating",   type: "uint16" },
          { name: "isLegend", type: "bool" },
          { name: "mintedAt", type: "uint32" },
        ],
      },
    ],
  },
  {
    name: "totalMinted",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "PlayerMinted",
    type: "event",
    inputs: [
      { name: "buyer",     type: "address", indexed: true },
      { name: "playerId",  type: "string",  indexed: false },
      { name: "tokenId",   type: "uint256", indexed: true },
      { name: "paid",      type: "uint96",  indexed: false },
    ],
  },
] as const;
