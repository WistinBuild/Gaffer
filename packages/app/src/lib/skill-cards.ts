import type { SkillCard } from "@/types/dughole";

export const SKILL_CARDS: SkillCard[] = [
  { id: "rabona",        name: "Rabona",            glyph: "✺",  description: "Unlocks rabona cross as a shooting option for wingers.", position_restriction: ["MID","FWD"], effect: "unlock_rabona" },
  { id: "death_glory",   name: "Death or Glory",    glyph: "⚡", description: "Adds a high-risk, high-reward option to every shooting decision.", effect: "high_risk_shot" },
  { id: "anchor",        name: "Anchor",            glyph: "⚓", description: "Defender stays deeper. Unlocks conservative defensive options.", position_restriction: ["DEF"], effect: "anchor_defence" },
  { id: "press_trigger", name: "Press Trigger",     glyph: "◆",  description: "Midfielder can call a team press as a tactical decision.", position_restriction: ["MID","FWD"], effect: "team_press" },
  { id: "ice_in_veins",  name: "Ice In Veins",      glyph: "❄",  description: "+2 Composure during the final 15 minutes of every match.", effect: "late_composure" },
  { id: "captain_armband",name:"Captain's Armband", glyph: "★",  description: "Player drags teammate morale up by 1 tier when nearby.", effect: "morale_boost" },
  { id: "rocket_left",   name: "Rocket Left Foot",  glyph: "⇇",  description: "+3 Finishing on shots from outside the box (left-footed).", effect: "left_shot_boost" },
  { id: "tireless",      name: "Tireless",          glyph: "♾",  description: "Stamina degrades 30% slower throughout the match.", effect: "stamina_save" },
];

export const cardById = (id: string) => SKILL_CARDS.find((c) => c.id === id);
