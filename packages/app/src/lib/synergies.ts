import type { DugholePlayer, Synergy } from "@/types/dughole";

export const SYNERGIES: Synergy[] = [
  {
    id: "samba",
    name: "Samba Rhythm",
    description: "Two Brazilian players unlock chemistry — +2 Composure team-wide.",
    check: (deck) => deck.filter((p) => p.nationCode === "BR").length >= 2,
    buff: { composure: 2 },
  },
  {
    id: "link_up",
    name: "Link-Up Play",
    description: "Deep playmaker + mobile striker — passing decisions +12% success.",
    check: (deck) => {
      const hasDeepPM = deck.some(
        (p) => p.position === "MID" && p.attrs.vision >= 14 && p.attrs.passing >= 14,
      );
      const hasMobile = deck.some(
        (p) => p.position === "FWD" && p.attrs.pace >= 14,
      );
      return hasDeepPM && hasMobile;
    },
    buff: { passing: 2, vision: 1 },
  },
  {
    id: "press_trap",
    name: "Press Trap",
    description: "Aggressive midfielder + aggressive defender — forces turnovers in their third.",
    check: (deck) =>
      deck.some((p) => p.position === "MID" && p.attrs.aggression >= 14) &&
      deck.some((p) => p.position === "DEF" && p.attrs.aggression >= 14),
    buff: { tackling: 2, anticipation: 1 },
  },
  {
    id: "wall",
    name: "The Wall",
    description: "Two centre backs with strength + jumping ≥ 16 — defensive duels +15%.",
    check: (deck) =>
      deck.filter(
        (p) => p.position === "DEF" && p.attrs.strength >= 14 && p.attrs.jumping >= 14,
      ).length >= 2,
    buff: { tackling: 2, strength: 1 },
  },
  {
    id: "old_heads",
    name: "Old Heads",
    description: "Two players age 30+ with leadership ≥ 14 — composure floor raised in late game.",
    check: (deck) => deck.filter((p) => p.age >= 30 && p.attrs.leadership >= 14).length >= 2,
    buff: { composure: 2, decisions: 1 },
  },
  {
    id: "pace",
    name: "Lightning",
    description: "Three players with pace ≥ 16 — counter-attack decisions +10%.",
    check: (deck) => deck.filter((p) => p.attrs.pace >= 16).length >= 3,
    buff: { pace: 1, agility: 1 },
  },
];

export function activeSynergies(deck: DugholePlayer[]): Synergy[] {
  return SYNERGIES.filter((s) => s.check(deck));
}
