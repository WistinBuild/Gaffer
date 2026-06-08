export type Position = "GK" | "DEF" | "MID" | "FWD" | "FLEX";

export type RarityTier = "bronze" | "silver" | "gold" | "icon";

export interface Player {
  id: string;
  name: string;
  shortName: string;
  nation: string;
  nationCode: string;
  position: Position;
  rating: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  /** True for World Cup legends — gets ICON rarity + price premium */
  legend?: boolean;
  /** Era a legend played in (e.g. "1974", "2002") — displayed on marketplace */
  era?: string;
}

export interface PlayerNFT extends Player {
  tokenId: number;
  owner: string;
  rarity: RarityTier;
  tournamentPoints: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  matchdaysPlayed: number;
}

export interface Squad {
  owner: string;
  players: PlayerNFT[];
  captain: number;  // tokenId
  benched: number;  // tokenId
  totalPoints: number;
}

export interface SquadWar {
  id: number;
  challenger: string;
  opponent: string;
  challengerSquad: Squad;
  opponentSquad: Squad;
  stake: bigint;
  matchday: number;
  status: "open" | "active" | "resolved";
  winner?: string;
  createdAt: number;
}

export type WorldCupStage =
  | "group"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "final";

export const STAGE_MULTIPLIERS: Record<WorldCupStage, number> = {
  group: 1.0,
  round_of_16: 1.2,
  quarter_final: 1.5,
  semi_final: 2.0,
  final: 3.0,
};

export const POSITION_SCORING = {
  GK: { cleanSheet: 12, goalConceded: -2, save: 1 },
  DEF: { cleanSheet: 8, goal: 8, assist: 6 },
  MID: { goal: 8, assist: 6, cleanSheet: 4 },
  FWD: { goal: 10, assist: 4 },
  FLEX: { goal: 8, assist: 5 },
};
