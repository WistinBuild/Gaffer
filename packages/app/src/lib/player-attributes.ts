/**
 * Derive full 17-attribute model from the existing 6-stat players.json.
 * Deterministic — same input always yields same output, no randomness.
 */

import type { Player } from "@/types";
import type { DugholePlayer, FullAttributes, PersonalityType } from "@/types/dughole";

// Stable PRNG so each playerId gets the same derived numbers every render
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(seed: number, salt: number): number {
  // 0..1 deterministic
  const x = Math.sin(seed + salt) * 10000;
  return x - Math.floor(x);
}

// Clamp + scale a 0–100 base stat into a 1–20 attribute
function to20(v: number, jitter = 0): number {
  const x = (v / 100) * 18 + 2 + jitter; // base in [2,20]
  return Math.max(1, Math.min(20, Math.round(x)));
}

const PERSONALITIES: PersonalityType[] = [
  "Cool Head",
  "Fiery",
  "Resilient",
  "Mercurial",
  "Professional",
];

export function deriveAttributes(p: Player): FullAttributes {
  const seed = hashSeed(p.id);
  const j = (salt: number, range = 2) => (pseudo(seed, salt) - 0.5) * range; // ±range/2

  const isAtt = p.position === "FWD";
  const isMid = p.position === "MID";
  const isDef = p.position === "DEF";
  const isGK = p.position === "GK";

  return {
    // Technical
    finishing: to20(p.shooting + (isAtt ? 6 : isMid ? 0 : -10) + j(1)),
    passing: to20(p.passing + j(2)),
    dribbling: to20((p.pace + p.shooting) / 2 + (isAtt ? 4 : isMid ? 2 : -2) + j(3)),
    first_touch: to20(p.rating - 8 + (isAtt ? 4 : isMid ? 6 : 0) + j(4)),
    crossing: to20(
      p.passing + (isMid ? 4 : isDef ? 2 : isAtt ? -2 : -10) + j(5),
    ),
    tackling: to20(p.defending + j(6)),

    // Mental
    decisions: to20(p.rating - 10 + j(7, 3)),
    composure: to20(p.rating - 12 + j(8, 4)),
    vision: to20(p.passing + (isMid ? 6 : isAtt ? 2 : -2) + j(9)),
    anticipation: to20(p.defending + (isDef || isGK ? 6 : 0) + j(10)),
    aggression: to20(p.physical - 20 + j(11, 6)),
    leadership: to20(p.rating - 20 + j(12, 5)),

    // Physical
    pace: to20(p.pace),
    strength: to20(p.physical + j(13, 2)),
    stamina: to20(p.physical + j(14, 3)),
    agility: to20(p.pace + j(15, 2)),
    jumping: to20(p.physical + (isGK ? 8 : isDef ? 4 : 0) + j(16)),
  };
}

export function derivePersonality(p: Player): PersonalityType {
  return PERSONALITIES[hashSeed(p.id) % PERSONALITIES.length];
}

export function deriveAge(p: Player): number {
  // 19 to 35 — synthetic but stable
  return 19 + (hashSeed(p.id) % 17);
}

export function enrichPlayer(p: Player): DugholePlayer {
  return {
    ...p,
    attrs: deriveAttributes(p),
    age: deriveAge(p),
    preferred_foot: hashSeed(p.id) % 4 === 0 ? "Left" : "Right",
    personality: derivePersonality(p),
  };
}

// ─── Attribute group breakdowns for UI ────────────────────────────────────────
export const TECHNICAL_KEYS: (keyof FullAttributes)[] = [
  "finishing", "passing", "dribbling", "first_touch", "crossing", "tackling",
];
export const MENTAL_KEYS: (keyof FullAttributes)[] = [
  "decisions", "composure", "vision", "anticipation", "aggression", "leadership",
];
export const PHYSICAL_KEYS: (keyof FullAttributes)[] = [
  "pace", "strength", "stamina", "agility", "jumping",
];

export const ATTR_LABELS: Record<keyof FullAttributes, string> = {
  finishing: "Finishing",
  passing: "Passing",
  dribbling: "Dribbling",
  first_touch: "First Touch",
  crossing: "Crossing",
  tackling: "Tackling",
  decisions: "Decisions",
  composure: "Composure",
  vision: "Vision",
  anticipation: "Anticipation",
  aggression: "Aggression",
  leadership: "Leadership",
  pace: "Pace",
  strength: "Strength",
  stamina: "Stamina",
  agility: "Agility",
  jumping: "Jumping",
};
