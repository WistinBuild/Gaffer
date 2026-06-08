/**
 * Dughole — extended types for the decision-engine match mechanic.
 * Layered on top of existing Player type (src/types/index.ts).
 */

import type { Player, Position } from "./index";

// ─── Full 17-attribute model ─────────────────────────────────────────────────
export interface FullAttributes {
  // Technical
  finishing: number;
  passing: number;
  dribbling: number;
  first_touch: number;
  crossing: number;
  tackling: number;
  // Mental
  decisions: number;
  composure: number;
  vision: number;
  anticipation: number;
  aggression: number;
  leadership: number;
  // Physical
  pace: number;
  strength: number;
  stamina: number;
  agility: number;
  jumping: number;
}

export type AttributeKey = keyof FullAttributes;

export interface DugholePlayer extends Player {
  attrs: FullAttributes; // all rated 1–20
  age: number;
  preferred_foot: "Left" | "Right" | "Both";
  personality: PersonalityType;
}

export type PersonalityType =
  | "Cool Head"
  | "Fiery"
  | "Resilient"
  | "Mercurial"
  | "Professional";

// ─── Roles ───────────────────────────────────────────────────────────────────
export interface Role {
  id: string;
  position: Position;
  name: string;
  description: string;
  buffs: Partial<Record<AttributeKey, number>>; // small attribute mods during match
}

// ─── Tactical instructions ───────────────────────────────────────────────────
export type Instruction =
  | "Sit Deep"
  | "Overlap"
  | "Stay Wide"
  | "Cut Inside"
  | "Press High"
  | "Hold Position";

export type Mentality = "Defensive" | "Balanced" | "Attacking" | "Counter";

// ─── Skill Cards ─────────────────────────────────────────────────────────────
export interface SkillCard {
  id: string;
  name: string;
  glyph: string;
  description: string;
  position_restriction?: Position[]; // who can equip
  effect: string; // "unlock_rabona" | "press_trigger" | etc — descriptive
}

// ─── Synergies ───────────────────────────────────────────────────────────────
export interface Synergy {
  id: string;
  name: string;
  description: string;
  // Returns true if this synergy is active given the deck
  check: (deck: DugholePlayer[]) => boolean;
  buff: Partial<Record<AttributeKey, number>>; // applied to all deck members
}

// ─── Match decision moments ──────────────────────────────────────────────────
export type DecisionCategory =
  | "attacking"
  | "defensive"
  | "tactical"
  | "squad_mgmt"
  | "set_piece";

export type Risk = "low" | "medium" | "high";

export type SuccessOutcome = "goal" | "key_pass" | "tackle_won" | "save" | "build_up";
export type FailConsequence =
  | "lose_possession"
  | "concede_goal"
  | "concede_penalty"
  | "yellow_card"
  | "free_kick_opp"
  | "injury";

export interface DecisionOption {
  id: string;
  label: string;
  primary_attr: AttributeKey;
  risk: Risk;
  /** Exactly one option per decision should have correct:true — the optimal call. */
  correct: boolean;
  /** What happens on a successful roll */
  successOutcome: SuccessOutcome;
  /** What happens on a failed roll (the cost of getting it wrong) */
  failConsequence: FailConsequence;
  reward_pts: number;
  fail_pts: number;
  description?: string;
}

export interface DecisionTemplate {
  id: string;
  category: DecisionCategory;
  minute_range: [number, number]; // when this can fire
  position_filter?: Position[]; // which deck player can be in this moment
  situation: (player: DugholePlayer) => string; // narrative description
  options: DecisionOption[];
}

// ─── Match state ─────────────────────────────────────────────────────────────
export interface PlayerMatchState {
  player: DugholePlayer;
  composure: number; // dynamic, starts at attrs.composure, can drop/rise
  stamina: number; // 0–100, starts 100
  morale: number; // -3 to +3
}

export interface MatchState {
  warId: string;
  minute: number; // 0–90
  yourScore: number;
  oppScore: number;
  momentum: number; // -10 to +10
  deck: PlayerMatchState[];
  decisionsTaken: DecisionResult[];
  active: DecisionMoment | null;
  status: "setup" | "live" | "paused" | "complete";
  setup: MatchSetup;
}

export interface MatchSetup {
  formation: string; // e.g. "1-2-1-1"
  roles: Record<string, string>; // playerId → roleId
  instructions: Record<string, Instruction>;
  mentality: Mentality;
  captainId: string;
  benchedId: string;
}

export interface DecisionMoment {
  template: DecisionTemplate;
  playerInVolved: DugholePlayer; // typo intentional — domain term
  startedAt: number; // timestamp for countdown
  durationMs: number;
}

export interface DecisionResult {
  decisionId: string;
  optionId: string;
  player: string;
  success: boolean;
  pointsScored: number;
  minute: number;
  momentumDelta: number;
  composureDelta: number;
}
